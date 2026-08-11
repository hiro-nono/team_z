import { createServer } from 'node:http'
import { addActionDecisions } from './action-decision.mjs'
import { NOTICE_SCHEMA, SYSTEM_PROMPT, validateNotice } from './notice-schema.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024)
const OPENAI_API_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

function setResponseHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Vary', 'Origin')
}

function sendJson(response, statusCode, payload) {
  setResponseHeaders(response)
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, { error: { code, message } })
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text
  }

  const outputText = payload.output
    ?.flatMap((item) => Array.isArray(item.content) ? item.content : [])
    ?.filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    ?.map((content) => content.text)
    ?.join('')

  return typeof outputText === 'string' ? outputText : ''
}

function parseJson(text) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(normalized)
}

async function analyzePdf(file) {
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    const error = new Error('ファイルサイズは10MB以下にしてください。')
    error.code = 'FILE_TOO_LARGE'
    error.statusCode = 413
    throw error
  }

  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    const error = new Error('PDFとして読み取れないファイルです。')
    error.code = 'INVALID_PDF'
    error.statusCode = 400
    throw error
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEYがサーバーに設定されていません。')
    error.code = 'AI_NOT_CONFIGURED'
    error.statusCode = 503
    throw error
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: `ファイル名: ${file.name || 'notice.pdf'}\nこのPDFを解析してください。` },
              {
                type: 'input_file',
                filename: file.name || 'notice.pdf',
                file_data: `data:application/pdf;base64,${bytes.toString('base64')}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'school_notice',
            strict: true,
            schema: NOTICE_SCHEMA,
          },
        },
      }),
    })

    let payload
    try {
      payload = await openAiResponse.json()
    } catch {
      const error = new Error('AIサービスの応答を読み取れませんでした。')
      error.code = 'AI_INVALID_RESPONSE'
      error.statusCode = 502
      throw error
    }

    if (!openAiResponse.ok) {
      const upstreamMessage = payload?.error?.message || 'AIサービスからエラーが返されました。'
      const error = new Error(upstreamMessage)
      error.code = 'AI_UPSTREAM_ERROR'
      error.statusCode = 502
      throw error
    }

    const outputText = extractOutputText(payload)
    if (!outputText) {
      const error = new Error('AIから構造化結果を取得できませんでした。')
      error.code = 'AI_EMPTY_OUTPUT'
      error.statusCode = 502
      throw error
    }

    let parsed
    try {
      parsed = parseJson(outputText)
    } catch {
      const error = new Error('AIの応答をJSONとして読み取れませんでした。')
      error.code = 'AI_INVALID_JSON'
      error.statusCode = 502
      throw error
    }

    const validationError = validateNotice(parsed)
    if (validationError) {
      const error = new Error(validationError)
      error.code = 'AI_SCHEMA_VALIDATION_ERROR'
      error.statusCode = 502
      throw error
    }

    return addActionDecisions(parsed)
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('AI解析がタイムアウトしました。もう一度お試しください。')
      timeoutError.code = 'AI_TIMEOUT'
      timeoutError.statusCode = 504
      throw timeoutError
    }

    if (!error?.statusCode && error?.name === 'TypeError') {
      const upstreamError = new Error('AIサービスへ接続できませんでした。')
      upstreamError.code = 'AI_CONNECTION_ERROR'
      upstreamError.statusCode = 502
      throw upstreamError
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function getUploadedFile(request) {
  const contentType = String(request.headers['content-type'] ?? '')
  if (!contentType.startsWith('multipart/form-data')) {
    const error = new Error('multipart/form-dataでPDFを送信してください。')
    error.code = 'INVALID_CONTENT_TYPE'
    error.statusCode = 400
    throw error
  }

  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (contentLength > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
    const error = new Error('ファイルサイズは10MB以下にしてください。')
    error.code = 'FILE_TOO_LARGE'
    error.statusCode = 413
    throw error
  }

  const origin = `http://${request.headers.host ?? 'localhost'}`
  const webRequest = new Request(new URL(request.url ?? '/', origin), {
    method: request.method,
    headers: request.headers,
    body: request,
    duplex: 'half',
  })
  const formData = await webRequest.formData()
  const file = formData.get('file')

  if (!file || typeof file.arrayBuffer !== 'function') {
    const error = new Error('PDFファイルを選択してください。')
    error.code = 'FILE_REQUIRED'
    error.statusCode = 400
    throw error
  }

  const filename = String(file.name ?? '')
  if (file.type !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
    const error = new Error('PDFファイルを選択してください。')
    error.code = 'INVALID_FILE_TYPE'
    error.statusCode = 415
    throw error
  }

  return file
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (request.method === 'OPTIONS') {
      setResponseHeaders(response)
      response.statusCode = 204
      response.end()
      return
    }

    if (url.pathname !== '/api/analyze') {
      sendError(response, 404, 'NOT_FOUND', '指定されたAPIは存在しません。')
      return
    }

    if (request.method !== 'POST') {
      sendError(response, 405, 'METHOD_NOT_ALLOWED', 'POSTでリクエストしてください。')
      return
    }

    const file = await getUploadedFile(request)
    const notice = await analyzePdf(file)
    sendJson(response, 200, notice)
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
    const code = error?.code ?? 'INTERNAL_SERVER_ERROR'
    const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。'
    sendError(response, statusCode, code, message)
  }
})

server.listen(PORT, () => {
  console.log(`PDF analysis API listening on http://localhost:${PORT}`)
})

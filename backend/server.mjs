import { createServer } from 'node:http'
import { addActionDecisions } from './action-decision.mjs'
import { AiClient, buildPdfResponseRequest } from './ai-client.mjs'
import { DEFAULT_ACCOUNT_ID, GoogleOAuthService } from './google-auth.mjs'
import { GoogleCalendarService } from './google-calendar.mjs'
import { NOTICE_SCHEMA, SYSTEM_PROMPT, validateNotice } from './notice-schema.mjs'

const PORT = Number(process.env.PORT ?? 3001)
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024)
const MAX_JSON_BODY_BYTES = 1024 * 1024
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
const FRONTEND_URL = process.env.FRONTEND_URL ?? FRONTEND_ORIGIN

const aiClient = new AiClient()
const googleOAuthService = new GoogleOAuthService()
const googleCalendarService = new GoogleCalendarService({ authService: googleOAuthService })

function setResponseHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const { payload } = await aiClient.responsesCreate(
      buildPdfResponseRequest({
        model: aiClient.model,
        systemPrompt: SYSTEM_PROMPT,
        fileName: file.name,
        pdfBytes: bytes,
        schema: NOTICE_SCHEMA,
      }),
      { signal: controller.signal },
    )

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

async function parseJsonBody(request) {
  const contentType = String(request.headers['content-type'] ?? '')
  if (!contentType.startsWith('application/json')) {
    const error = new Error('application/jsonでリクエストしてください。')
    error.code = 'INVALID_CONTENT_TYPE'
    error.statusCode = 400
    throw error
  }

  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (contentLength > MAX_JSON_BODY_BYTES) {
    const error = new Error('リクエストが大きすぎます。')
    error.code = 'REQUEST_TOO_LARGE'
    error.statusCode = 413
    throw error
  }

  let body = ''
  for await (const chunk of request) {
    body += chunk.toString()
    if (Buffer.byteLength(body) > MAX_JSON_BODY_BYTES) {
      const error = new Error('リクエストが大きすぎます。')
      error.code = 'REQUEST_TOO_LARGE'
      error.statusCode = 413
      throw error
    }
  }

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error('JSONを読み取れませんでした。')
    error.code = 'INVALID_JSON'
    error.statusCode = 400
    throw error
  }
}

function redirectToFrontend(response, status, reason) {
  const target = new URL(FRONTEND_URL)
  target.searchParams.set('google', status)
  if (reason) {
    target.searchParams.set('reason', reason)
  }
  response.statusCode = 302
  response.setHeader('Location', target.toString())
  response.end()
}

function stripClientDecision(candidate) {
  const cleanCandidate = { ...candidate }
  delete cleanCandidate.action_decision
  delete cleanCandidate.action_reason
  return cleanCandidate
}

async function handleGoogleAuthCallback(response, url) {
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    const context = await googleOAuthService.consumeState(state)
    if (!context) {
      sendError(response, 400, 'OAUTH_STATE_MISMATCH', 'OAuth stateの検証に失敗しました。')
      return
    }
    redirectToFrontend(response, 'error', 'oauth_denied')
    return
  }

  const code = url.searchParams.get('code')
  if (!state || !code) {
    sendError(response, 400, 'OAUTH_CALLBACK_INVALID', 'OAuth callbackにcodeまたはstateがありません。')
    return
  }

  try {
    await googleOAuthService.exchangeCode(code, state)
    redirectToFrontend(response, 'connected')
  } catch (error) {
    if (error?.code === 'OAUTH_STATE_MISMATCH') {
      sendError(response, 400, error.code, error.message)
      return
    }
    redirectToFrontend(response, 'error', error?.code ?? 'oauth_failed')
  }
}

async function handleCalendarEventCreate(request, response) {
  const body = await parseJsonBody(request)
  if (typeof body !== 'object' || body === null || typeof body.candidate !== 'object' || body.candidate === null) {
    sendError(response, 400, 'CANDIDATE_REQUIRED', 'calendar_candidateを指定してください。')
    return
  }

  const result = await googleCalendarService.createEvent({
    accountId: DEFAULT_ACCOUNT_ID,
    candidate: stripClientDecision(body.candidate),
    confirmed: body.confirmed === true,
  })
  sendJson(response, 200, result)
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

    if (url.pathname === '/api/google/auth/start' && request.method === 'GET') {
      const { url: authorizationUrl } = await googleOAuthService.createAuthorizationUrl(DEFAULT_ACCOUNT_ID)
      sendJson(response, 200, { url: authorizationUrl })
      return
    }

    if (url.pathname === '/api/google/auth/callback' && request.method === 'GET') {
      await handleGoogleAuthCallback(response, url)
      return
    }

    if (url.pathname === '/api/google/status' && request.method === 'GET') {
      sendJson(response, 200, await googleOAuthService.getConnectionStatus(DEFAULT_ACCOUNT_ID))
      return
    }

    if (url.pathname === '/api/calendar/events' && request.method === 'POST') {
      await handleCalendarEventCreate(request, response)
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

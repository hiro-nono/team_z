import OpenAI from 'openai'

export const AI_PROVIDERS = Object.freeze({
  ORCAROUTER: 'orcarouter',
  OPENAI: 'openai',
})

export const DEFAULT_ORCAROUTER_BASE_URL = 'https://api.orcarouter.ai/v1'
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_ORCAROUTER_MODEL = 'openai/gpt-4o-mini'
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
export const AI_REQUEST_TIMEOUT_MS = 90_000

export class AiClientError extends Error {
  constructor(code, statusCode, message, options = {}) {
    super(message, options)
    this.name = 'AiClientError'
    this.code = code
    this.statusCode = statusCode
  }
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(asTrimmedString(value).toLowerCase())
}

function normalizeBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new AiClientError('AI_CONFIG_INVALID', 503, 'AI_BASE_URLの形式が不正です。')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AiClientError('AI_CONFIG_INVALID', 503, 'AI_BASE_URLはHTTP(S) URLで指定してください。')
  }

  if (url.pathname.endsWith('/responses')) {
    url.pathname = url.pathname.slice(0, -'/responses'.length)
  }

  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}

export function resolveAiConfig(env = process.env) {
  const provider = asTrimmedString(env.AI_PROVIDER || AI_PROVIDERS.ORCAROUTER).toLowerCase()
  if (!Object.values(AI_PROVIDERS).includes(provider)) {
    throw new AiClientError('AI_CONFIG_INVALID', 503, 'AI_PROVIDERはorcarouterまたはopenaiで指定してください。')
  }

  const baseUrlValue = asTrimmedString(env.AI_BASE_URL)
    || (provider === AI_PROVIDERS.ORCAROUTER
      ? DEFAULT_ORCAROUTER_BASE_URL
      : asTrimmedString(env.OPENAI_API_URL).replace(/\/responses\/?$/, '') || DEFAULT_OPENAI_BASE_URL)

  const apiKey = asTrimmedString(env.AI_API_KEY)
    || (provider === AI_PROVIDERS.OPENAI ? asTrimmedString(env.OPENAI_API_KEY) : '')

  const model = asTrimmedString(env.AI_MODEL)
    || (provider === AI_PROVIDERS.ORCAROUTER
      ? DEFAULT_ORCAROUTER_MODEL
      : asTrimmedString(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL)

  return Object.freeze({
    provider,
    baseURL: normalizeBaseUrl(baseUrlValue),
    apiKey,
    model,
    debug: parseBoolean(env.AI_DEBUG),
  })
}

function getHeader(headers, name) {
  if (!headers || typeof headers.get !== 'function') {
    return null
  }

  const value = headers.get(name)
  return typeof value === 'string' && value.length > 0 ? value : null
}

function responseMetadata({ provider, model, response }) {
  const headers = response?.headers
  return {
    provider,
    requestedModel: model,
    resolvedModel: getHeader(headers, 'x-orca-resolved-model'),
    router: getHeader(headers, 'x-orca-router'),
    fallbackModel: getHeader(headers, 'x-orca-fallback-model'),
    fallbackLevel: getHeader(headers, 'x-orca-fallback-level'),
    requestId: getHeader(headers, 'x-request-id'),
  }
}

function redactSecret(message, secret) {
  if (typeof message !== 'string' || message.length === 0) {
    return ''
  }

  return secret ? message.split(secret).join('[redacted]') : message
}

export function buildPdfResponseRequest({ model, systemPrompt, fileName, pdfBytes, schema }) {
  const safeFileName = asTrimmedString(fileName) || 'notice.pdf'

  return {
    model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: `ファイル名: ${safeFileName}\nこのPDFを解析してください。` },
          {
            type: 'input_file',
            filename: safeFileName,
            file_data: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'school_notice',
        strict: true,
        schema,
      },
    },
  }
}

export class AiClient {
  #client = null

  #apiKey

  #logger

  constructor({ env = process.env, clientFactory = (options) => new OpenAI(options), logger = console } = {}) {
    const config = resolveAiConfig(env)
    this.provider = config.provider
    this.baseURL = config.baseURL
    this.model = config.model
    this.debug = config.debug
    this.#apiKey = config.apiKey
    this.clientFactory = clientFactory
    this.#logger = logger
  }

  get publicConfig() {
    return Object.freeze({
      provider: this.provider,
      baseURL: this.baseURL,
      model: this.model,
      debug: this.debug,
    })
  }

  getClient() {
    if (!this.#apiKey) {
      const keyName = this.provider === AI_PROVIDERS.ORCAROUTER ? 'AI_API_KEY' : 'AI_API_KEYまたはOPENAI_API_KEY'
      throw new AiClientError('AI_NOT_CONFIGURED', 503, `${keyName}がサーバーに設定されていません。`)
    }

    if (!this.#client) {
      this.#client = this.clientFactory({
        apiKey: this.#apiKey,
        baseURL: this.baseURL,
        maxRetries: 0,
        timeout: AI_REQUEST_TIMEOUT_MS,
      })
    }

    if (!this.#client?.responses || typeof this.#client.responses.create !== 'function') {
      throw new AiClientError('AI_CLIENT_INVALID', 503, 'Responses API対応のAIクライアントを初期化できませんでした。')
    }

    return this.#client
  }

  async responsesCreate(request, { signal } = {}) {
    try {
      const responseRequest = signal ? this.getClient().responses.create(request, { signal }) : this.getClient().responses.create(request)

      if (responseRequest && typeof responseRequest.withResponse === 'function') {
        const result = await responseRequest.withResponse()
        const payload = result?.data
        const metadata = responseMetadata({
          provider: this.provider,
          model: this.model,
          response: result?.response,
        })
        this.reportMetadata(metadata)
        return { payload, metadata }
      }

      const payload = await responseRequest
      const metadata = responseMetadata({ provider: this.provider, model: this.model })
      this.reportMetadata(metadata)
      return { payload, metadata }
    } catch (error) {
      throw this.toClientError(error)
    }
  }

  reportMetadata(metadata) {
    if (!this.debug || typeof this.#logger?.info !== 'function') {
      return
    }

    this.#logger.info('[ai-client] response metadata', metadata)
  }

  toClientError(error) {
    if (error instanceof AiClientError) {
      return error
    }

    if (error?.name === 'AbortError' || error?.name === 'APIUserAbortError' || error?.name === 'APIConnectionTimeoutError' || error?.code === 'ETIMEDOUT') {
      return new AiClientError('AI_TIMEOUT', 504, 'AI解析がタイムアウトしました。もう一度お試しください。', { cause: error })
    }

    if (error?.name === 'APIConnectionError' || error?.name === 'TypeError') {
      return new AiClientError('AI_CONNECTION_ERROR', 502, 'AIサービスへ接続できませんでした。', { cause: error })
    }

    const message = redactSecret(error?.message, this.#apiKey) || 'AIサービスからエラーが返されました。'
    return new AiClientError('AI_UPSTREAM_ERROR', 502, message, { cause: error })
  }
}

import { randomBytes, randomUUID } from 'node:crypto'
import { google } from 'googleapis'

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
export const DEFAULT_ACCOUNT_ID = 'local-dev-account'
const STATE_TTL_MS = 10 * 60 * 1000
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000

export class GoogleIntegrationError extends Error {
  constructor(code, statusCode, message) {
    super(message)
    this.name = 'GoogleIntegrationError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class InMemoryOAuthStateStore {
  constructor({ now = () => Date.now(), ttlMs = STATE_TTL_MS } = {}) {
    this.now = now
    this.ttlMs = ttlMs
    this.states = new Map()
  }

  async save(state, context) {
    this.states.set(state, { ...context, expiresAt: this.now() + this.ttlMs })
  }

  async consume(state) {
    const context = this.states.get(state)
    this.states.delete(state)

    if (!context || context.expiresAt <= this.now()) {
      return null
    }

    return context
  }
}

export class InMemoryGoogleTokenStore {
  constructor() {
    this.connections = new Map()
  }

  async get(accountId) {
    return this.connections.get(accountId) ?? null
  }

  async save(connection) {
    this.connections.set(connection.accountId, { ...connection })
    return this.connections.get(connection.accountId)
  }

  async update(accountId, patch) {
    const existing = await this.get(accountId)
    if (!existing) {
      return null
    }

    const updated = {
      ...existing,
      ...patch,
      accessToken: patch.accessToken ?? existing.accessToken,
      refreshToken: patch.refreshToken ?? existing.refreshToken,
      expiresAt: patch.expiresAt ?? existing.expiresAt,
      scopes: patch.scopes ?? existing.scopes,
    }
    this.connections.set(accountId, updated)
    return updated
  }
}

function normalizeScopes(scopeValue, fallback = []) {
  if (Array.isArray(scopeValue)) {
    return scopeValue.filter((scope) => typeof scope === 'string' && scope.length > 0)
  }

  if (typeof scopeValue === 'string') {
    return scopeValue.split(/\s+/).filter(Boolean)
  }

  return fallback
}

function assertCode(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new GoogleIntegrationError('OAUTH_CODE_REQUIRED', 400, 'Google OAuth codeがありません。')
  }
}

export class GoogleOAuthService {
  constructor({
    clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/google/auth/callback',
    scope = GOOGLE_CALENDAR_SCOPE,
    tokenStore = new InMemoryGoogleTokenStore(),
    stateStore = new InMemoryOAuthStateStore(),
    oauthClientFactory = (id, secret, redirect) => new google.auth.OAuth2(id, secret, redirect),
    now = () => Date.now(),
  } = {}) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = redirectUri
    this.scope = scope
    this.tokenStore = tokenStore
    this.stateStore = stateStore
    this.oauthClientFactory = oauthClientFactory
    this.now = now
  }

  assertConfigured() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new GoogleIntegrationError('GOOGLE_NOT_CONFIGURED', 503, 'Google OAuthの環境変数が設定されていません。')
    }
  }

  createClient() {
    this.assertConfigured()
    return this.oauthClientFactory(this.clientId, this.clientSecret, this.redirectUri)
  }

  async createAuthorizationUrl(accountId = DEFAULT_ACCOUNT_ID) {
    const client = this.createClient()
    const state = randomBytes(32).toString('hex')
    await this.stateStore.save(state, {
      accountId,
      scopes: [this.scope],
      createdAt: this.now(),
    })

    const url = client.generateAuthUrl({
      access_type: 'offline',
      client_id: this.clientId,
      prompt: 'consent',
      scope: [this.scope],
      state,
      include_granted_scopes: true,
    })

    return { url, state }
  }

  async consumeState(state) {
    if (typeof state !== 'string' || state.length === 0) {
      return null
    }

    return this.stateStore.consume(state)
  }

  async exchangeCode(code, state) {
    assertCode(code)
    const context = await this.consumeState(state)
    if (!context) {
      throw new GoogleIntegrationError('OAUTH_STATE_MISMATCH', 400, 'OAuth stateの検証に失敗しました。')
    }

    let tokenResponse
    try {
      tokenResponse = await this.createClient().getToken(code)
    } catch {
      throw new GoogleIntegrationError('OAUTH_TOKEN_EXCHANGE_FAILED', 502, 'Google OAuth codeをtokenへ交換できませんでした。')
    }

    const tokens = tokenResponse?.tokens ?? {}
    if (!tokens.access_token) {
      throw new GoogleIntegrationError('OAUTH_TOKEN_MISSING', 502, 'Googleからaccess tokenを取得できませんでした。')
    }

    const existing = await this.tokenStore.get(context.accountId)
    await this.tokenStore.save({
      id: existing?.id ?? randomUUID(),
      accountId: context.accountId,
      // calendar.events scopeだけではGoogleのuser IDを取得しないため、MVPではnullを保持する。
      providerUserId: existing?.providerUserId ?? null,
      accessToken: tokens.access_token,
      // Googleがrefresh_tokenを返さない再認証では既存値を必ず保持する。
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
      expiresAt: tokens.expiry_date ?? existing?.expiresAt ?? null,
      scopes: normalizeScopes(tokens.scope, context.scopes),
    })

    return { accountId: context.accountId }
  }

  async getConnectionStatus(accountId = DEFAULT_ACCOUNT_ID) {
    const connection = await this.tokenStore.get(accountId)
    return { connected: Boolean(connection?.accessToken || connection?.refreshToken) }
  }

  async getAuthorizedClient(accountId = DEFAULT_ACCOUNT_ID) {
    const connection = await this.tokenStore.get(accountId)
    if (!connection?.accessToken && !connection?.refreshToken) {
      throw new GoogleIntegrationError('GOOGLE_NOT_CONNECTED', 401, 'Google Calendarが接続されていません。')
    }

    const client = this.createClient()
    client.setCredentials({
      access_token: connection.accessToken ?? undefined,
      refresh_token: connection.refreshToken ?? undefined,
      expiry_date: connection.expiresAt ?? undefined,
    })

    const shouldRefresh = !connection.accessToken || !connection.expiresAt || connection.expiresAt <= this.now() + TOKEN_REFRESH_BUFFER_MS
    if (!shouldRefresh) {
      return client
    }

    if (!connection.refreshToken) {
      throw new GoogleIntegrationError('GOOGLE_REAUTH_REQUIRED', 401, 'Googleのrefresh tokenがないため、再認証が必要です。')
    }

    try {
      await client.getAccessToken()
    } catch {
      throw new GoogleIntegrationError('GOOGLE_REAUTH_REQUIRED', 401, 'Google tokenを更新できませんでした。再認証してください。')
    }

    const refreshed = client.credentials ?? {}
    if (!refreshed.access_token) {
      throw new GoogleIntegrationError('GOOGLE_REAUTH_REQUIRED', 401, 'Google access tokenを更新できませんでした。再認証してください。')
    }

    await this.tokenStore.update(accountId, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      expiresAt: refreshed.expiry_date ?? connection.expiresAt,
    })

    return client
  }
}

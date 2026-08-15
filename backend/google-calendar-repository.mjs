import { randomUUID } from 'node:crypto'
import { DatabaseError } from './db.mjs'

// google_calendar_connectionsの実カラムはprovider/provider_id/expired_at/scope(単数)であり、
// Goバックエンド(internal/model/google_calendar_connection.go)のスキーマに合わせている。
const GOOGLE_PROVIDER = 'google'

export const GOOGLE_CALENDAR_CONNECTION_SELECT_SQL = `
  SELECT
    provider_id,
    access_token,
    refresh_token,
    expired_at,
    scope
  FROM google_calendar_connections
  WHERE account_id = $1
  LIMIT 1
`

const GOOGLE_CALENDAR_CONNECTION_UPSERT_SQL = `
  INSERT INTO google_calendar_connections (
    id,
    account_id,
    provider,
    provider_id,
    access_token,
    refresh_token,
    expired_at,
    scope
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT (account_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_id = EXCLUDED.provider_id,
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    expired_at = EXCLUDED.expired_at,
    scope = EXCLUDED.scope,
    updated_at = NOW()
  RETURNING provider_id, access_token, refresh_token, expired_at, scope
`

const GOOGLE_CALENDAR_CONNECTION_UPDATE_SQL = `
  UPDATE google_calendar_connections
  SET access_token = $2,
      refresh_token = $3,
      expired_at = $4,
      scope = $5,
      updated_at = NOW()
  WHERE account_id = $1
  RETURNING provider_id, access_token, refresh_token, expired_at, scope
`

function toEpochMilliseconds(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeScopes(value) {
  if (Array.isArray(value)) {
    return value.filter((scope) => typeof scope === 'string' && scope.length > 0)
  }

  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean)
  }

  return []
}

function mapConnection(row) {
  if (!row) {
    return null
  }

  return {
    providerUserId: row.provider_id || null,
    accessToken: row.access_token ?? null,
    refreshToken: row.refresh_token ?? null,
    expiresAt: toEpochMilliseconds(row.expired_at),
    scopes: normalizeScopes(row.scope),
  }
}

function scopesToText(scopes) {
  return normalizeScopes(scopes).join(' ')
}

function assertPool(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new DatabaseError('DATABASE_NOT_CONFIGURED', 503, 'PostgreSQL接続が設定されていません。')
  }
}

function wrapDatabaseError(error) {
  if (error instanceof DatabaseError) {
    return error
  }

  return new DatabaseError('DATABASE_QUERY_FAILED', 503, 'PostgreSQLからGoogle Calendar接続情報を取得できませんでした。', { cause: error })
}

export class GoogleCalendarConnectionRepository {
  constructor({ pool }) {
    this.pool = pool
  }

  async getGoogleCalendarConnection(accountId) {
    assertPool(this.pool)

    try {
      const result = await this.pool.query(GOOGLE_CALENDAR_CONNECTION_SELECT_SQL, [accountId])
      return mapConnection(result.rows[0])
    } catch (error) {
      throw wrapDatabaseError(error)
    }
  }

  async get(accountId) {
    return this.getGoogleCalendarConnection(accountId)
  }

  async save(connection) {
    assertPool(this.pool)

    try {
      const result = await this.pool.query(GOOGLE_CALENDAR_CONNECTION_UPSERT_SQL, [
        connection.id ?? randomUUID(),
        connection.accountId,
        GOOGLE_PROVIDER,
        // provider_idはNOT NULLだが、calendar.events scopeだけではGoogleのuser IDを取得しないため空文字を許容する
        connection.providerUserId ?? '',
        connection.accessToken ?? null,
        connection.refreshToken ?? null,
        connection.expiresAt ? new Date(connection.expiresAt) : null,
        scopesToText(connection.scopes),
      ])
      return mapConnection(result.rows[0])
    } catch (error) {
      throw wrapDatabaseError(error)
    }
  }

  async update(accountId, patch) {
    assertPool(this.pool)

    try {
      const existing = await this.getGoogleCalendarConnection(accountId)
      if (!existing) {
        return null
      }

      const expiresAt = patch.expiresAt ?? existing.expiresAt

      const result = await this.pool.query(GOOGLE_CALENDAR_CONNECTION_UPDATE_SQL, [
        accountId,
        patch.accessToken ?? existing.accessToken,
        patch.refreshToken ?? existing.refreshToken,
        expiresAt ? new Date(expiresAt) : null,
        scopesToText(patch.scopes ?? existing.scopes),
      ])
      return mapConnection(result.rows[0])
    } catch (error) {
      throw wrapDatabaseError(error)
    }
  }
}

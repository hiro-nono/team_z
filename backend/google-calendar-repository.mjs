import { randomUUID } from 'node:crypto'
import { DatabaseError } from './db.mjs'

export const GOOGLE_CALENDAR_CONNECTION_SELECT_SQL = `
  SELECT
    provider_user_id,
    access_token,
    refresh_token,
    expires_at,
    scopes
  FROM google_calendar_connections
  WHERE account_id = $1
  LIMIT 1
`

const GOOGLE_CALENDAR_CONNECTION_UPSERT_SQL = `
  INSERT INTO google_calendar_connections (
    id,
    account_id,
    provider_user_id,
    access_token,
    refresh_token,
    expires_at,
    scopes
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (account_id) DO UPDATE SET
    provider_user_id = EXCLUDED.provider_user_id,
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    expires_at = EXCLUDED.expires_at,
    scopes = EXCLUDED.scopes,
    updated_at = NOW()
  RETURNING provider_user_id, access_token, refresh_token, expires_at, scopes
`

const GOOGLE_CALENDAR_CONNECTION_UPDATE_SQL = `
  UPDATE google_calendar_connections
  SET access_token = $2,
      refresh_token = $3,
      expires_at = $4,
      scopes = $5,
      updated_at = NOW()
  WHERE account_id = $1
  RETURNING provider_user_id, access_token, refresh_token, expires_at, scopes
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
    providerUserId: row.provider_user_id ?? null,
    accessToken: row.access_token ?? null,
    refreshToken: row.refresh_token ?? null,
    expiresAt: toEpochMilliseconds(row.expires_at),
    scopes: normalizeScopes(row.scopes),
  }
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
        connection.providerUserId ?? null,
        connection.accessToken ?? null,
        connection.refreshToken ?? null,
        connection.expiresAt ? new Date(connection.expiresAt) : null,
        normalizeScopes(connection.scopes),
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
        normalizeScopes(patch.scopes ?? existing.scopes),
      ])
      return mapConnection(result.rows[0])
    } catch (error) {
      throw wrapDatabaseError(error)
    }
  }
}

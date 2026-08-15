import assert from 'node:assert/strict'
import test from 'node:test'
import { getAccountIdFromRequest } from '../account-context.mjs'
import { DatabaseError, createDatabasePool } from '../db.mjs'
import {
  GOOGLE_CALENDAR_CONNECTION_SELECT_SQL,
  GoogleCalendarConnectionRepository,
} from '../google-calendar-repository.mjs'

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111'

function requestWithHeaders(headers = {}) {
  return { headers }
}

test('AccountID is read from X-Account-ID and normalized as a UUID', () => {
  assert.equal(
    getAccountIdFromRequest(requestWithHeaders({ 'x-account-id': ACCOUNT_ID.toUpperCase() })),
    ACCOUNT_ID,
  )
})

test('missing AccountID is rejected with 401', () => {
  assert.throws(
    () => getAccountIdFromRequest(requestWithHeaders()),
    (error) => error.code === 'ACCOUNT_ID_REQUIRED' && error.statusCode === 401,
  )
})

test('invalid AccountID is rejected with 400', () => {
  assert.throws(
    () => getAccountIdFromRequest(requestWithHeaders({ 'x-account-id': 'account-1' })),
    (error) => error.code === 'ACCOUNT_ID_INVALID' && error.statusCode === 400,
  )
})

test('OAuth connection is read with a parameterized account_id query', async () => {
  const calls = []
  const repository = new GoogleCalendarConnectionRepository({
    pool: {
      async query(text, values) {
        calls.push({ text, values })
        return {
          rows: [{
            provider_user_id: 'google-user-1',
            access_token: 'access-token-secret',
            refresh_token: 'refresh-token-secret',
            expires_at: new Date('2026-08-12T00:00:00.000Z'),
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
          }],
        }
      },
    },
  })

  const connection = await repository.getGoogleCalendarConnection(ACCOUNT_ID)

  assert.deepEqual(connection, {
    providerUserId: 'google-user-1',
    accessToken: 'access-token-secret',
    refreshToken: 'refresh-token-secret',
    expiresAt: new Date('2026-08-12T00:00:00.000Z').getTime(),
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].values[0], ACCOUNT_ID)
  assert.match(calls[0].text, /WHERE account_id = \$1/u)
  assert.equal(calls[0].text.includes(ACCOUNT_ID), false)
  assert.equal(calls[0].text, GOOGLE_CALENDAR_CONNECTION_SELECT_SQL)
})

test('no OAuth connection returns null without exposing token fields', async () => {
  const repository = new GoogleCalendarConnectionRepository({
    pool: { async query() { return { rows: [] } } },
  })

  const connection = await repository.getGoogleCalendarConnection(ACCOUNT_ID)

  assert.equal(connection, null)
  assert.equal(JSON.stringify({ connected: Boolean(connection) }).includes('token'), false)
})

test('database errors are converted to a safe backend error', async () => {
  const repository = new GoogleCalendarConnectionRepository({
    pool: { async query() { throw new Error('password=should-not-escape') } },
  })

  await assert.rejects(
    repository.getGoogleCalendarConnection(ACCOUNT_ID),
    (error) => error instanceof DatabaseError
      && error.code === 'DATABASE_QUERY_FAILED'
      && error.statusCode === 503
      && !error.message.includes('password'),
  )
})

test('missing DATABASE_URL is reported without connecting', () => {
  assert.throws(
    () => createDatabasePool({ env: {} }),
    (error) => error.code === 'DATABASE_NOT_CONFIGURED' && error.statusCode === 503,
  )
})

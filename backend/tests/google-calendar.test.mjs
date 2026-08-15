import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GOOGLE_CALENDAR_SCOPE,
  GoogleOAuthService,
  InMemoryGoogleTokenStore,
} from '../google-auth.mjs'
import {
  GoogleCalendarService,
  InMemoryCalendarEventStore,
  mapCandidateToGoogleEvent,
} from '../google-calendar.mjs'
import { ACTION_DECISIONS } from '../action-decision.mjs'

function candidate(overrides = {}) {
  return {
    kind: 'event',
    title: '秋の遠足',
    date: '2026-09-04',
    date_status: 'exact',
    start_time: '08:30',
    end_time: null,
    location: '学校正門',
    items: ['弁当', '水筒'],
    required_actions: [],
    confidence: 0.97,
    source_evidence: '9月4日（金）8時30分集合',
    ...overrides,
  }
}

function createCalendarHarness() {
  let insertCount = 0
  let lastRequest = null
  const authService = {
    async getAuthorizedClient() {
      return { fake: true }
    },
  }
  const calendarService = new GoogleCalendarService({
    authService,
    eventStore: new InMemoryCalendarEventStore(),
    calendarClientFactory: () => ({
      events: {
        async insert(request) {
          insertCount += 1
          lastRequest = request
          return {
            data: {
              id: 'event-1',
              htmlLink: 'https://calendar.google.com/calendar/event?eid=event-1',
            },
          }
        },
      },
    }),
  })

  return {
    calendarService,
    get insertCount() {
      return insertCount
    },
    get lastRequest() {
      return lastRequest
    },
  }
}

test('OAuth start URL uses offline access and the minimum Calendar scope', async () => {
  let authUrlOptions
  const oauthService = new GoogleOAuthService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:3001/api/google/auth/callback',
    oauthClientFactory: () => ({
      generateAuthUrl(options) {
        authUrlOptions = options
        return 'https://accounts.google.com/o/oauth2/v2/auth?state=test'
      },
    }),
  })

  const result = await oauthService.createAuthorizationUrl('account-1')

  assert.match(result.url, /^https:\/\/accounts\.google\.com/)
  assert.equal(typeof result.state, 'string')
  assert.equal(result.state.length, 64)
  assert.equal(authUrlOptions.access_type, 'offline')
  assert.deepEqual(authUrlOptions.scope, [GOOGLE_CALENDAR_SCOPE])
  assert.equal(authUrlOptions.state, result.state)
})

test('OAuth callback rejects a state mismatch', async () => {
  const oauthService = new GoogleOAuthService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:3001/api/google/auth/callback',
    oauthClientFactory: () => ({ getToken: async () => ({ tokens: { access_token: 'never-used' } }) }),
  })

  await assert.rejects(
    oauthService.exchangeCode('authorization-code', 'wrong-state'),
    (error) => error.code === 'OAUTH_STATE_MISMATCH' && error.statusCode === 400,
  )
})

test('AUTO_CREATE candidate is mapped and sent to Google Calendar', async () => {
  const harness = createCalendarHarness()
  const result = await harness.calendarService.createEvent({
    accountId: 'account-1',
    candidate: candidate(),
  })

  assert.equal(result.action_decision, ACTION_DECISIONS.AUTO_CREATE)
  assert.equal(result.duplicate, false)
  assert.equal(result.event.id, 'event-1')
  assert.equal(harness.insertCount, 1)
  assert.equal(harness.lastRequest.calendarId, 'primary')
  assert.equal(harness.lastRequest.requestBody.summary, '秋の遠足')
  assert.deepEqual(harness.lastRequest.requestBody.start, {
    dateTime: '2026-09-04T08:30:00',
    timeZone: 'Asia/Tokyo',
  })
  assert.deepEqual(harness.lastRequest.requestBody.end, {
    dateTime: '2026-09-04T09:30:00',
    timeZone: 'Asia/Tokyo',
  })
  assert.match(harness.lastRequest.requestBody.description, /弁当/u)
  assert.match(harness.lastRequest.requestBody.description, /9月4日/u)
})

test('CONFIRM_REQUIRED candidate is rejected without explicit confirmation', async () => {
  const harness = createCalendarHarness()
  const confirmCandidate = candidate({ confidence: 0.85 })

  await assert.rejects(
    harness.calendarService.createEvent({
      accountId: 'account-1',
      candidate: confirmCandidate,
      confirmed: false,
    }),
    (error) => error.code === 'CONFIRMATION_REQUIRED' && error.statusCode === 400,
  )
  assert.equal(harness.insertCount, 0)
})

test('CONFIRM_REQUIRED candidate is created after explicit confirmation', async () => {
  const harness = createCalendarHarness()
  const result = await harness.calendarService.createEvent({
    accountId: 'account-1',
    candidate: candidate({ confidence: 0.85 }),
    confirmed: true,
  })

  assert.equal(result.action_decision, ACTION_DECISIONS.CONFIRM_REQUIRED)
  assert.equal(harness.insertCount, 1)
})

test('BLOCKED candidate is rejected even when confirmed', async () => {
  const harness = createCalendarHarness()
  const blockedCandidate = candidate({
    date: null,
    date_status: 'ambiguous',
    start_time: null,
    confidence: 0.99,
    source_evidence: '9月上旬に実施予定です',
  })

  await assert.rejects(
    harness.calendarService.createEvent({
      accountId: 'account-1',
      candidate: blockedCandidate,
      confirmed: true,
    }),
    (error) => error.code === 'CANDIDATE_BLOCKED' && error.statusCode === 400,
  )
  assert.equal(harness.insertCount, 0)
})

test('Google未接続の場合はCalendar APIを呼ばずに拒否する', async () => {
  const insertCalls = []
  const calendarService = new GoogleCalendarService({
    authService: {
      async getAuthorizedClient() {
        const error = new Error('not connected')
        error.code = 'GOOGLE_NOT_CONNECTED'
        error.statusCode = 401
        throw error
      },
    },
    calendarClientFactory: () => ({
      events: {
        async insert(request) {
          insertCalls.push(request)
        },
      },
    }),
  })

  await assert.rejects(
    calendarService.createEvent({ accountId: 'account-1', candidate: candidate() }),
    (error) => error.code === 'GOOGLE_NOT_CONNECTED' && error.statusCode === 401,
  )
  assert.equal(insertCalls.length, 0)
})

test('same candidate is not created twice for the same account', async () => {
  const harness = createCalendarHarness()
  const first = await harness.calendarService.createEvent({ accountId: 'account-1', candidate: candidate() })
  const second = await harness.calendarService.createEvent({ accountId: 'account-1', candidate: candidate() })

  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
  assert.equal(second.event.id, first.event.id)
  assert.equal(harness.insertCount, 1)
})

test('expired access token is refreshed and saved without losing refresh token', async () => {
  const tokenStore = new InMemoryGoogleTokenStore()
  await tokenStore.save({
    id: 'connection-1',
    accountId: 'account-1',
    providerUserId: null,
    accessToken: 'expired-access',
    refreshToken: 'refresh-token',
    expiresAt: 1,
    scopes: [GOOGLE_CALENDAR_SCOPE],
  })

  let refreshCalls = 0
  let credentials = {}
  const oauthService = new GoogleOAuthService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:3001/api/google/auth/callback',
    tokenStore,
    now: () => 10_000,
    oauthClientFactory: () => ({
      setCredentials(value) {
        credentials = { ...value }
      },
      async getAccessToken() {
        refreshCalls += 1
        credentials = {
          ...credentials,
          access_token: 'refreshed-access',
          refresh_token: undefined,
          expiry_date: 3_600_000,
        }
        this.credentials = credentials
        return { token: 'refreshed-access' }
      },
      credentials,
    }),
  })

  await oauthService.getAuthorizedClient('account-1')
  const saved = await tokenStore.get('account-1')

  assert.equal(refreshCalls, 1)
  assert.equal(saved.accessToken, 'refreshed-access')
  assert.equal(saved.refreshToken, 'refresh-token')
  assert.equal(saved.expiresAt, 3_600_000)
})

test('reauthentication without a new refresh token preserves the existing token', async () => {
  const tokenStore = new InMemoryGoogleTokenStore()
  await tokenStore.save({
    id: 'connection-1',
    accountId: 'account-1',
    providerUserId: null,
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: 1,
    scopes: [GOOGLE_CALENDAR_SCOPE],
  })

  let getTokenCalls = 0
  const oauthService = new GoogleOAuthService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:3001/api/google/auth/callback',
    tokenStore,
    oauthClientFactory: () => ({
      generateAuthUrl: () => 'https://accounts.google.com/auth',
      async getToken() {
        getTokenCalls += 1
        return { tokens: { access_token: 'new-access', expiry_date: 3_600_000 } }
      },
    }),
  })

  const { state } = await oauthService.createAuthorizationUrl('account-1')
  await oauthService.exchangeCode('authorization-code', state)
  const saved = await tokenStore.get('account-1')

  assert.equal(getTokenCalls, 1)
  assert.equal(saved.accessToken, 'new-access')
  assert.equal(saved.refreshToken, 'old-refresh')
})

test('date-only candidate becomes an all-day event with an exclusive end date', () => {
  const mapped = mapCandidateToGoogleEvent(candidate({ start_time: null }))

  assert.deepEqual(mapped.start, { date: '2026-09-04' })
  assert.deepEqual(mapped.end, { date: '2026-09-05' })
})

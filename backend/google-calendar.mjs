import { createHash } from 'node:crypto'
import { google } from 'googleapis'
import { ACTION_DECISIONS, decideCandidate } from './action-decision.mjs'
import { GoogleIntegrationError } from './google-auth.mjs'
import { validateCandidate } from './notice-schema.mjs'

export const CALENDAR_TIME_ZONE = 'Asia/Tokyo'
export const DEFAULT_EVENT_DURATION_MINUTES = 60

export class InMemoryCalendarEventStore {
  constructor() {
    this.events = new Map()
  }

  key(accountId, fingerprint) {
    return `${accountId}:${fingerprint}`
  }

  async get(accountId, fingerprint) {
    return this.events.get(this.key(accountId, fingerprint)) ?? null
  }

  async save(accountId, fingerprint, event) {
    this.events.set(this.key(accountId, fingerprint), { ...event, fingerprint })
    return this.events.get(this.key(accountId, fingerprint))
  }
}

function normalizeTitle(title) {
  return title.normalize('NFKC').trim().toLocaleLowerCase('ja-JP')
}

export function candidateFingerprint(candidate) {
  const stableValue = [
    candidate.kind,
    normalizeTitle(candidate.title),
    candidate.date ?? '',
    candidate.start_time ?? '',
  ].join('|')

  return createHash('sha256').update(stableValue, 'utf8').digest('hex')
}

function addOneDay(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function addMinutesInTokyo(date, time, minutes) {
  const value = new Date(`${date}T${time}:00+09:00`)
  value.setUTCMinutes(value.getUTCMinutes() + minutes)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:00`
}

function buildDescription(candidate) {
  const blocks = []
  if (candidate.items.length > 0) {
    blocks.push(`持ち物:\n${candidate.items.map((item) => `- ${item}`).join('\n')}`)
  }
  if (candidate.required_actions.length > 0) {
    blocks.push(`必要な行動:\n${candidate.required_actions.map((action) => `- ${action}`).join('\n')}`)
  }
  blocks.push(`元資料の根拠:\n${candidate.source_evidence}`)

  if (candidate.start_time && !candidate.end_time) {
    blocks.push(`※終了時刻が記載されていないため、終了時刻は${DEFAULT_EVENT_DURATION_MINUTES}分後に設定しています。`)
  }

  return blocks.join('\n\n')
}

export function mapCandidateToGoogleEvent(candidate) {
  const description = buildDescription(candidate)
  const event = {
    summary: candidate.title.trim(),
    description,
  }

  if (candidate.location) {
    event.location = candidate.location
  }

  if (!candidate.start_time) {
    event.start = { date: candidate.date }
    event.end = { date: addOneDay(candidate.date) }
    return event
  }

  event.start = {
    dateTime: `${candidate.date}T${candidate.start_time}:00`,
    timeZone: CALENDAR_TIME_ZONE,
  }
  event.end = {
    dateTime: candidate.end_time
      ? `${candidate.date}T${candidate.end_time}:00`
      : addMinutesInTokyo(candidate.date, candidate.start_time, DEFAULT_EVENT_DURATION_MINUTES),
    timeZone: CALENDAR_TIME_ZONE,
  }
  return event
}

export function assertRegistrationAllowed(candidate, confirmed = false) {
  const validationError = validateCandidate(candidate)
  if (validationError) {
    throw new GoogleIntegrationError('CANDIDATE_INVALID', 400, validationError)
  }

  const decision = decideCandidate(candidate)
  if (decision.action_decision === ACTION_DECISIONS.BLOCKED) {
    throw new GoogleIntegrationError('CANDIDATE_BLOCKED', 400, decision.action_reason)
  }

  if (decision.action_decision === ACTION_DECISIONS.CONFIRM_REQUIRED && confirmed !== true) {
    throw new GoogleIntegrationError('CONFIRMATION_REQUIRED', 400, 'この予定はconfirmed:trueで明示的に確認してから登録してください。')
  }

  return decision
}

export class GoogleCalendarService {
  constructor({
    authService,
    eventStore = new InMemoryCalendarEventStore(),
    calendarClientFactory = (authClient) => google.calendar({ version: 'v3', auth: authClient }),
  }) {
    this.authService = authService
    this.eventStore = eventStore
    this.calendarClientFactory = calendarClientFactory
  }

  async createEvent({ accountId, candidate, confirmed = false }) {
    const decision = assertRegistrationAllowed(candidate, confirmed)
    const fingerprint = candidateFingerprint(candidate)
    const existing = await this.eventStore.get(accountId, fingerprint)

    if (existing) {
      return {
        duplicate: true,
        fingerprint,
        action_decision: decision.action_decision,
        event: existing,
      }
    }

    const authClient = await this.authService.getAuthorizedClient(accountId)
    const calendar = this.calendarClientFactory(authClient)
    let apiResponse
    try {
      apiResponse = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: mapCandidateToGoogleEvent(candidate),
      })
    } catch (error) {
      if (error?.code === 401) {
        throw new GoogleIntegrationError('GOOGLE_ACCESS_TOKEN_INVALID', 401, 'Google access tokenが無効です。再認証してください。')
      }
      throw new GoogleIntegrationError('GOOGLE_CALENDAR_API_ERROR', 502, 'Google Calendar APIでイベントを作成できませんでした。')
    }

    const data = apiResponse?.data ?? {}
    if (!data.id) {
      throw new GoogleIntegrationError('GOOGLE_CALENDAR_INVALID_RESPONSE', 502, 'Google Calendar APIの応答にevent idがありません。')
    }

    const event = {
      id: data.id,
      htmlLink: data.htmlLink ?? null,
    }
    await this.eventStore.save(accountId, fingerprint, event)

    return {
      duplicate: false,
      fingerprint,
      action_decision: decision.action_decision,
      event,
    }
  }
}

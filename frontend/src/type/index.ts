// csrf_token
export type CsrfTokenType = {
  csrf_token :string,
}

// account
export type AccountType = {
  id :string,
  auth_id :string,
  role :string,
  account_status :string,
  created_at :string,
  updated_at :string,
}

// pdf calendar (Go backend: POST /api/analyze, POST /api/calendar/events)
export type CandidateKind = 'event' | 'deadline'
export type DateStatus = 'exact' | 'ambiguous' | 'missing'

export type CalendarCandidate = {
  kind: CandidateKind
  title: string
  date: string | null
  date_status: DateStatus
  start_time: string | null
  end_time: string | null
  location: string | null
  items: string[]
  required_actions: string[]
  confidence: number
  source_evidence: string
}

export type SchoolNotice = {
  document_type: 'school_notice'
  summary: string
  calendar_candidates: CalendarCandidate[]
  general_items: string[]
  general_actions: string[]
}

// Google Calendarへの登録可否判断。AI(OrcaRouter)は事実抽出のみを行い、
// この判断はBackend(Go)がmodel.CalendarCandidate.Decide()で一元的に計算する。
export type ActionDecision = 'AUTO_CREATE' | 'CONFIRM_REQUIRED' | 'BLOCKED'

export type CalendarCandidateWithDecision = CalendarCandidate & {
  action_decision: ActionDecision
  action_reason: string
}

export type SchoolNoticeWithDecision = Omit<SchoolNotice, 'calendar_candidates'> & {
  calendar_candidates: CalendarCandidateWithDecision[]
}

export type GoogleStatusType = {
  connected: boolean
}

export type GoogleAuthStartType = {
  url: string
}

export type CalendarEventType = {
  id: string
  htmlLink: string
}

export type CalendarEventResultType = {
  duplicate: boolean
  action_decision: ActionDecision
  event: CalendarEventType
}
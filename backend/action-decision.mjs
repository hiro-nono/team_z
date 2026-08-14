import { AMBIGUOUS_DATE_PATTERN, DATE_STATUS, isValidExactDate } from './notice-schema.mjs'

export const ACTION_DECISIONS = Object.freeze({
  AUTO_CREATE: 'AUTO_CREATE',
  CONFIRM_REQUIRED: 'CONFIRM_REQUIRED',
  BLOCKED: 'BLOCKED',
})

export const AUTO_CREATE_CONFIDENCE = 0.90
export const CONFIRM_REQUIRED_CONFIDENCE = 0.70

function blocked(reason) {
  return { action_decision: ACTION_DECISIONS.BLOCKED, action_reason: reason }
}

export function hasAmbiguousDateEvidence(sourceEvidence) {
  return AMBIGUOUS_DATE_PATTERN.test(sourceEvidence)
}

export function decideCandidate(candidate) {
  if (!candidate.title.trim()) {
    return blocked('タイトルがないため登録できません。')
  }

  if (candidate.date_status === DATE_STATUS.AMBIGUOUS || hasAmbiguousDateEvidence(candidate.source_evidence)) {
    return blocked('日付表現が曖昧なため登録できません。')
  }

  if (candidate.date_status === DATE_STATUS.MISSING || candidate.date === null) {
    return blocked('日付がないため登録できません。')
  }

  if (!isValidExactDate(candidate.date)) {
    return blocked('日付が確定した形式ではないため登録できません。')
  }

  if (candidate.confidence < CONFIRM_REQUIRED_CONFIDENCE) {
    return blocked(`信頼度が${CONFIRM_REQUIRED_CONFIDENCE.toFixed(2)}未満のため登録できません。`)
  }

  if (candidate.confidence >= AUTO_CREATE_CONFIDENCE) {
    return {
      action_decision: ACTION_DECISIONS.AUTO_CREATE,
      action_reason: `日付が確定しており、信頼度が${AUTO_CREATE_CONFIDENCE.toFixed(2)}以上です。`,
    }
  }

  return {
    action_decision: ACTION_DECISIONS.CONFIRM_REQUIRED,
    action_reason: `日付はありますが、信頼度が${AUTO_CREATE_CONFIDENCE.toFixed(2)}未満のため確認が必要です。`,
  }
}

export function addActionDecisions(notice) {
  return {
    ...notice,
    calendar_candidates: notice.calendar_candidates.map((candidate) => ({
      ...candidate,
      ...decideCandidate(candidate),
    })),
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_DECISIONS, addActionDecisions, decideCandidate } from '../action-decision.mjs'
import { validateNotice } from '../notice-schema.mjs'

function candidate(overrides = {}) {
  return {
    kind: 'event',
    title: '秋の遠足',
    date: '2026-09-04',
    date_status: 'exact',
    start_time: '08:30',
    end_time: null,
    location: null,
    items: ['弁当', '水筒'],
    required_actions: [],
    confidence: 0.97,
    source_evidence: '9月4日（金）8時30分集合',
    ...overrides,
  }
}

function notice(calendarCandidates = [candidate()]) {
  return {
    document_type: 'school_notice',
    summary: '学校行事のお知らせ',
    calendar_candidates: calendarCandidates,
    general_items: [],
    general_actions: [],
  }
}

test('行事が1件だけのPDF: 高信頼度の確定日付はAUTO_CREATE', () => {
  const result = addActionDecisions(notice())
  assert.equal(result.calendar_candidates[0].action_decision, ACTION_DECISIONS.AUTO_CREATE)
})

test('行事＋提出期限があるPDF: 2件を別々の予定候補として判定', () => {
  const result = addActionDecisions(notice([
    candidate(),
    candidate({
      kind: 'deadline',
      title: '遠足参加同意書 提出期限',
      date: '2026-08-28',
      start_time: null,
      items: [],
      required_actions: ['参加同意書を提出する'],
      confidence: 0.95,
      source_evidence: '8月28日までにご提出ください',
    }),
  ]))

  assert.equal(result.calendar_candidates.length, 2)
  assert.deepEqual(
    result.calendar_candidates.map((item) => item.action_decision),
    [ACTION_DECISIONS.AUTO_CREATE, ACTION_DECISIONS.AUTO_CREATE],
  )
})

test('複数行事があるPDF: 予定ごとにCONFIRM_REQUIREDを判定', () => {
  const result = addActionDecisions(notice([
    candidate({ title: '秋の遠足', confidence: 0.97 }),
    candidate({ title: '授業参観', date: '2026-09-10', confidence: 0.85, source_evidence: '9月10日に授業参観を行います' }),
  ]))

  assert.deepEqual(
    result.calendar_candidates.map((item) => item.action_decision),
    [ACTION_DECISIONS.AUTO_CREATE, ACTION_DECISIONS.CONFIRM_REQUIRED],
  )
})

test('「9月上旬」など曖昧なPDF: dateを具体化せずBLOCKED', () => {
  const ambiguous = candidate({
    date: null,
    date_status: 'ambiguous',
    start_time: null,
    confidence: 0.96,
    source_evidence: '9月上旬に実施予定です',
  })

  const result = decideCandidate(ambiguous)
  assert.equal(result.action_decision, ACTION_DECISIONS.BLOCKED)
  assert.match(result.action_reason, /曖昧/u)
})

test('日程情報が一切ないPDF: 候補はBLOCKED', () => {
  const result = addActionDecisions(notice([
    candidate({
      title: '保護者へのお願い',
      date: null,
      date_status: 'missing',
      start_time: null,
      confidence: 0.95,
      source_evidence: 'ご家庭でご確認ください',
    }),
  ]))

  assert.equal(result.calendar_candidates[0].action_decision, ACTION_DECISIONS.BLOCKED)
  assert.match(result.calendar_candidates[0].action_reason, /日付がない/u)
})

test('AI出力schemaが壊れているケース: source_evidence欠落を検証エラーにする', () => {
  const broken = notice([candidate()])
  delete broken.calendar_candidates[0].source_evidence

  assert.match(validateNotice(broken), /source_evidence/u)
})

test('Backendはevidence内の「頃」も検出し、LLMが具体日付を出してもBLOCKEDにする', () => {
  const result = decideCandidate(candidate({ source_evidence: '9月4日頃に実施します' }))
  assert.equal(result.action_decision, ACTION_DECISIONS.BLOCKED)
})

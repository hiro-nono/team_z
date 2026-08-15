import type { CalendarCandidate } from '../../type'

// action_decisionの計算自体はBackend(Go: model.CalendarCandidate.Decide())が行う。
// ここではUI側で候補を一意に識別するためのキー生成のみを担う。
export function candidateKey(candidate: CalendarCandidate) {
  return [candidate.kind, candidate.title.trim().normalize('NFKC').toLocaleLowerCase('ja-JP'), candidate.date ?? '', candidate.start_time ?? ''].join('|')
}

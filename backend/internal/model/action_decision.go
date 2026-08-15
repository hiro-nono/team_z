package model

import (
	"fmt"
	"regexp"
	"strings"
)

// ActionDecision はCalendarCandidateのGoogle Calendarへの登録可否判断
type ActionDecision string

const (
	ActionDecisionAutoCreate      ActionDecision = "AUTO_CREATE"
	ActionDecisionConfirmRequired ActionDecision = "CONFIRM_REQUIRED"
	ActionDecisionBlocked         ActionDecision = "BLOCKED"
)

const (
	autoCreateConfidence      = 0.90
	confirmRequiredConfidence = 0.70
)

// ambiguousDateEvidencePattern は「9月上旬」「月末」「来週」「頃」等、日付が確定していない表現の根拠を検出する
var ambiguousDateEvidencePattern = regexp.MustCompile(`(上旬|中旬|下旬|前半|後半|月初|月末|頃|ごろ|ころ|未定|近日|来週|再来週|今週)`)

// CalendarCandidateWithDecision はCalendarCandidateにActionDecisionを付与したもの
type CalendarCandidateWithDecision struct {
	CalendarCandidate
	ActionDecision ActionDecision `json:"action_decision"`
	ActionReason   string         `json:"action_reason"`
}

// Decide はcandidateの内容からGoogle Calendarへの登録可否を判定する。
// AI(OrcaRouter)は事実抽出のみを行い、登録可否判断はBackend側でこのメソッドが一元的に行う。
// PDF解析結果(/api/analyze)の表示用途と、実際の登録(/api/calendar/events)時の再検証の両方で使用する。
func (c CalendarCandidate) Decide() (ActionDecision, string) {
	if strings.TrimSpace(c.Title) == "" {
		return ActionDecisionBlocked, "タイトルがないため登録できません。"
	}

	if c.DateStatus == DateStatusAmbiguous || ambiguousDateEvidencePattern.MatchString(c.SourceEvidence) {
		return ActionDecisionBlocked, "日付表現が曖昧なため登録できません。"
	}

	if c.DateStatus == DateStatusMissing || c.Date == nil {
		return ActionDecisionBlocked, "日付がないため登録できません。"
	}

	if c.Confidence < confirmRequiredConfidence {
		return ActionDecisionBlocked, fmt.Sprintf("信頼度が%.2f未満のため登録できません。", confirmRequiredConfidence)
	}

	if c.Confidence >= autoCreateConfidence {
		return ActionDecisionAutoCreate, fmt.Sprintf("日付が確定しており、信頼度が%.2f以上です。", autoCreateConfidence)
	}

	return ActionDecisionConfirmRequired, fmt.Sprintf("日付はありますが、信頼度が%.2f未満のため確認が必要です。", autoCreateConfidence)
}

// WithDecision はCalendarCandidateにDecide()の結果を付与したCalendarCandidateWithDecisionを返す
func (c CalendarCandidate) WithDecision() CalendarCandidateWithDecision {
	decision, reason := c.Decide()
	return CalendarCandidateWithDecision{
		CalendarCandidate: c,
		ActionDecision:    decision,
		ActionReason:      reason,
	}
}

// SchoolNoticeWithDecision はSchoolNoticeの各CalendarCandidateにActionDecisionを付与したもの
type SchoolNoticeWithDecision struct {
	DocumentType       string                          `json:"document_type"`
	Summary            string                          `json:"summary"`
	CalendarCandidates []CalendarCandidateWithDecision `json:"calendar_candidates"`
	GeneralItems       []string                        `json:"general_items"`
	GeneralActions     []string                        `json:"general_actions"`
}

// WithDecisions はSchoolNoticeの全candidateにActionDecisionを付与する
func (n *SchoolNotice) WithDecisions() *SchoolNoticeWithDecision {
	candidates := make([]CalendarCandidateWithDecision, len(n.CalendarCandidates))
	for i, candidate := range n.CalendarCandidates {
		candidates[i] = candidate.WithDecision()
	}

	return &SchoolNoticeWithDecision{
		DocumentType:       n.DocumentType,
		Summary:            n.Summary,
		CalendarCandidates: candidates,
		GeneralItems:       n.GeneralItems,
		GeneralActions:     n.GeneralActions,
	}
}

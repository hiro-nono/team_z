package model

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// CandidateKind はCalendarCandidateの種別
type CandidateKind string

const (
	CandidateKindEvent    CandidateKind = "event"
	CandidateKindDeadline CandidateKind = "deadline"
)

// DateStatus はCalendarCandidateの日付が確定しているかどうかを表す
type DateStatus string

const (
	DateStatusExact     DateStatus = "exact"
	DateStatusAmbiguous DateStatus = "ambiguous"
	DateStatusMissing   DateStatus = "missing"
)

var (
	dateStringPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	timeStringPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
)

// CalendarCandidate はPDFから抽出された、カレンダー登録候補となる1件の行事・提出期限
type CalendarCandidate struct {
	Kind            CandidateKind `json:"kind"`
	Title           string        `json:"title"`
	Date            *string       `json:"date"`
	DateStatus      DateStatus    `json:"date_status"`
	StartTime       *string       `json:"start_time"`
	EndTime         *string       `json:"end_time"`
	Location        *string       `json:"location"`
	Items           []string      `json:"items"`
	RequiredActions []string      `json:"required_actions"`
	Confidence      float64       `json:"confidence"`
	SourceEvidence  string        `json:"source_evidence"`
}

// SchoolNotice はAIがPDFから抽出した学校のお知らせの構造化結果
// Google Calendarへの登録可否判断(action_decision)はこの構造体には含めない
type SchoolNotice struct {
	DocumentType       string              `json:"document_type"`
	Summary            string              `json:"summary"`
	CalendarCandidates []CalendarCandidate `json:"calendar_candidates"`
	GeneralItems       []string            `json:"general_items"`
	GeneralActions     []string            `json:"general_actions"`
}

// Validate はOrcaRouterから返されたSchoolNoticeが抽出ルールを満たしているかを検証する。
// OrcaRouter側のJSON Schema(strict:true)を通過していても、Backend側で最終的に同じ制約を再検証する。
func (n *SchoolNotice) Validate() error {
	if n.DocumentType != "school_notice" {
		return fmt.Errorf("document_type must be \"school_notice\"")
	}

	if n.CalendarCandidates == nil {
		return fmt.Errorf("calendar_candidates must be an array")
	}
	for i := range n.CalendarCandidates {
		if err := n.CalendarCandidates[i].Validate(); err != nil {
			return fmt.Errorf("calendar_candidates[%d]: %w", i, err)
		}
	}

	if n.GeneralItems == nil {
		return fmt.Errorf("general_items must be an array")
	}
	if n.GeneralActions == nil {
		return fmt.Errorf("general_actions must be an array")
	}

	return nil
}

// Validate はCalendarCandidate単体の抽出ルール(日付・時刻の形式、date_statusとdateの整合性など)を検証する。
// SchoolNotice.Validate()からだけでなく、Google Calendar登録時の入力検証としても再利用する。
func (c *CalendarCandidate) Validate() error {
	if c.Kind != CandidateKindEvent && c.Kind != CandidateKindDeadline {
		return fmt.Errorf("kind must be \"event\" or \"deadline\"")
	}

	switch c.DateStatus {
	case DateStatusExact, DateStatusAmbiguous, DateStatusMissing:
	default:
		return fmt.Errorf("date_status must be \"exact\", \"ambiguous\" or \"missing\"")
	}

	if c.Date != nil && !isValidDateString(*c.Date) {
		return fmt.Errorf("date must be YYYY-MM-DD or null")
	}
	if c.DateStatus == DateStatusExact && c.Date == nil {
		return fmt.Errorf("date must not be null when date_status is \"exact\"")
	}
	if c.DateStatus != DateStatusExact && c.Date != nil {
		return fmt.Errorf("date must be null when date_status is not \"exact\"")
	}

	if c.StartTime != nil && !timeStringPattern.MatchString(*c.StartTime) {
		return fmt.Errorf("start_time must be HH:mm or null")
	}
	if c.EndTime != nil && !timeStringPattern.MatchString(*c.EndTime) {
		return fmt.Errorf("end_time must be HH:mm or null")
	}

	if c.Items == nil {
		return fmt.Errorf("items must be an array")
	}
	if c.RequiredActions == nil {
		return fmt.Errorf("required_actions must be an array")
	}

	if c.Confidence < 0 || c.Confidence > 1 {
		return fmt.Errorf("confidence must be between 0 and 1")
	}

	if strings.TrimSpace(c.SourceEvidence) == "" {
		return fmt.Errorf("source_evidence is required")
	}

	return nil
}

// isValidDateString はYYYY-MM-DD形式かつ実在する日付かどうかを検証する。
// time.Parseは月ごとの日数超過(例: 2024-02-30)を自動繰り上げしてしまうため、
// 一度フォーマットし直して元の文字列と一致するかで実在性を確認する。
func isValidDateString(value string) bool {
	if !dateStringPattern.MatchString(value) {
		return false
	}

	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return false
	}

	return t.Format("2006-01-02") == value
}

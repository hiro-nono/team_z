// Package googlecalendar はGoogle Calendar API(v3)とのHTTP通信を閉じ込める。
// usecaseは本パッケージのFindEventByFingerprint/CreateEventのみを呼び出し、
// リクエスト/レスポンスの形式や認証ヘッダーの詳細を意識しない。
package googlecalendar

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	_ "time/tzdata"

	"github.com/hiro-nono/team_z/backend/internal/model"
)

// TimeZone はGoogle Calendarへ登録するイベントのタイムゾーン
const TimeZone = "Asia/Tokyo"

// DefaultEventDurationMinutes はend_timeが指定されていない場合に、start_timeから加算する分数
const DefaultEventDurationMinutes = 60

// eventsEndpoint はprimary calendarのEventsリソースに対するエンドポイント
const eventsEndpoint = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

// fingerprintPropertyKey は重複登録防止のためイベントに埋め込むextendedProperties.privateのキー
const fingerprintPropertyKey = "fingerprint"

// maxResponseBodyBytes はGoogle Calendar APIからのレスポンスボディを読み取る上限
const maxResponseBodyBytes = 2 * 1024 * 1024

var (
	// ErrAccessTokenInvalid はGoogleがaccess tokenを無効と判断した場合のエラー(401)
	ErrAccessTokenInvalid = errors.New("google access token is invalid")
	// ErrAPIError はGoogle Calendar APIがその他のエラーまたは不正なレスポンスを返した場合のエラー
	ErrAPIError = errors.New("google calendar api returned an error")
)

// CalendarEvent はGoogle Calendar APIから返されたイベントのうち、呼び出し側が必要とする情報
type CalendarEvent struct {
	ID       string
	HTMLLink string
}

// Client はGoogle Calendar API(v3)のprimary calendarに対してイベントの検索・作成を行う
type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{httpClient: http.DefaultClient}
}

type eventDateTime struct {
	Date     string `json:"date,omitempty"`
	DateTime string `json:"dateTime,omitempty"`
	TimeZone string `json:"timeZone,omitempty"`
}

type eventExtendedProperties struct {
	Private map[string]string `json:"private,omitempty"`
}

type eventRequest struct {
	Summary            string                   `json:"summary"`
	Description        string                   `json:"description,omitempty"`
	Location           string                   `json:"location,omitempty"`
	Start              eventDateTime            `json:"start"`
	End                eventDateTime            `json:"end"`
	ExtendedProperties *eventExtendedProperties `json:"extendedProperties,omitempty"`
}

type eventResponse struct {
	ID       string `json:"id"`
	HTMLLink string `json:"htmlLink"`
}

type eventListResponse struct {
	Items []eventResponse `json:"items"`
}

// FindEventByFingerprint はfingerprintをextendedProperties.privateに持つイベントをprimary calendarから検索する。
// 見つからない場合はnil, nilを返す。
func (c *Client) FindEventByFingerprint(ctx context.Context, accessToken string, fingerprint string) (*CalendarEvent, error) {
	query := url.Values{
		"privateExtendedProperty": {fingerprintPropertyKey + "=" + fingerprint},
		"maxResults":              {"1"},
		"singleEvents":            {"true"},
		"showDeleted":             {"false"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, eventsEndpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build google calendar list request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	body, statusCode, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if statusCode == http.StatusUnauthorized {
		return nil, ErrAccessTokenInvalid
	}
	if statusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrAPIError, statusCode)
	}

	var parsed eventListResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("%w: failed to decode response", ErrAPIError)
	}

	if len(parsed.Items) == 0 {
		return nil, nil
	}

	return &CalendarEvent{ID: parsed.Items[0].ID, HTMLLink: parsed.Items[0].HTMLLink}, nil
}

// CreateEvent はcandidateをprimary calendarへ1件のイベントとして作成する。
// fingerprintはextendedProperties.privateへ保存し、以降のFindEventByFingerprintでの重複検出に使う。
func (c *Client) CreateEvent(ctx context.Context, accessToken string, candidate model.CalendarCandidate, fingerprint string) (*CalendarEvent, error) {
	reqBody, err := buildEventRequest(candidate, fingerprint)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to build google calendar request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, eventsEndpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build google calendar request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	body, statusCode, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if statusCode == http.StatusUnauthorized {
		return nil, ErrAccessTokenInvalid
	}
	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		return nil, fmt.Errorf("%w: status %d", ErrAPIError, statusCode)
	}

	var parsed eventResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("%w: failed to decode response", ErrAPIError)
	}
	if parsed.ID == "" {
		return nil, fmt.Errorf("%w: response missing event id", ErrAPIError)
	}

	return &CalendarEvent{ID: parsed.ID, HTMLLink: parsed.HTMLLink}, nil
}

func (c *Client) do(req *http.Request) ([]byte, int, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: %s", ErrAPIError, err.Error())
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBodyBytes))
	if err != nil {
		return nil, 0, fmt.Errorf("%w: failed to read response body", ErrAPIError)
	}

	return body, resp.StatusCode, nil
}

func buildEventRequest(candidate model.CalendarCandidate, fingerprint string) (*eventRequest, error) {
	if candidate.Date == nil {
		return nil, fmt.Errorf("candidate date is required to create a calendar event")
	}

	event := &eventRequest{
		Summary:     strings.TrimSpace(candidate.Title),
		Description: buildDescription(candidate),
		ExtendedProperties: &eventExtendedProperties{
			Private: map[string]string{fingerprintPropertyKey: fingerprint},
		},
	}
	if candidate.Location != nil {
		event.Location = *candidate.Location
	}

	if candidate.StartTime == nil {
		endDate, err := addOneDay(*candidate.Date)
		if err != nil {
			return nil, err
		}
		event.Start = eventDateTime{Date: *candidate.Date}
		event.End = eventDateTime{Date: endDate}
		return event, nil
	}

	startDateTime, err := parseTokyoDateTime(*candidate.Date, *candidate.StartTime)
	if err != nil {
		return nil, err
	}
	event.Start = eventDateTime{DateTime: formatTokyoDateTime(startDateTime), TimeZone: TimeZone}

	if candidate.EndTime != nil {
		endDateTime, err := parseTokyoDateTime(*candidate.Date, *candidate.EndTime)
		if err != nil {
			return nil, err
		}
		event.End = eventDateTime{DateTime: formatTokyoDateTime(endDateTime), TimeZone: TimeZone}
	} else {
		event.End = eventDateTime{
			DateTime: formatTokyoDateTime(startDateTime.Add(DefaultEventDurationMinutes * time.Minute)),
			TimeZone: TimeZone,
		}
	}

	return event, nil
}

func buildDescription(candidate model.CalendarCandidate) string {
	var blocks []string
	if len(candidate.Items) > 0 {
		blocks = append(blocks, "持ち物:\n"+bulletList(candidate.Items))
	}
	if len(candidate.RequiredActions) > 0 {
		blocks = append(blocks, "必要な行動:\n"+bulletList(candidate.RequiredActions))
	}
	blocks = append(blocks, "元資料の根拠:\n"+candidate.SourceEvidence)
	if candidate.StartTime != nil && candidate.EndTime == nil {
		blocks = append(blocks, fmt.Sprintf("※終了時刻が記載されていないため、終了時刻は%d分後に設定しています。", DefaultEventDurationMinutes))
	}

	return strings.Join(blocks, "\n\n")
}

func bulletList(items []string) string {
	lines := make([]string, len(items))
	for i, item := range items {
		lines[i] = "- " + item
	}
	return strings.Join(lines, "\n")
}

func addOneDay(date string) (string, error) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return "", fmt.Errorf("invalid candidate date: %w", err)
	}
	return t.AddDate(0, 0, 1).Format("2006-01-02"), nil
}

func parseTokyoDateTime(date string, clockTime string) (time.Time, error) {
	loc, err := time.LoadLocation(TimeZone)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to load timezone %s: %w", TimeZone, err)
	}

	t, err := time.ParseInLocation("2006-01-02 15:04", date+" "+clockTime, loc)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid candidate date/time: %w", err)
	}

	return t, nil
}

func formatTokyoDateTime(t time.Time) string {
	return t.Format("2006-01-02T15:04:05")
}

package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/googleauth"
	"github.com/hiro-nono/team_z/backend/internal/googlecalendar"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"github.com/hiro-nono/team_z/backend/internal/repository"
)

// tokenRefreshBuffer はaccess tokenの有効期限がこの時間以内に迫っている場合、期限切れ前でも更新する猶予
const tokenRefreshBuffer = 60 * time.Second

var (
	// ErrCandidateInvalid はcandidateが抽出ルール(Schema)を満たさない場合のエラー
	ErrCandidateInvalid = errors.New("candidate is invalid")
	// ErrCandidateBlocked はcandidateのActionDecisionがBLOCKEDのため登録できない場合のエラー
	ErrCandidateBlocked = errors.New("candidate is blocked from registration")
	// ErrConfirmationRequired はcandidateのActionDecisionがCONFIRM_REQUIREDにもかかわらず
	// confirmed=trueが指定されなかった場合のエラー
	ErrConfirmationRequired = errors.New("candidate requires confirmation before registration")
	// ErrGoogleNotConnected はAccountにGoogleカレンダー連携情報が存在しない場合のエラー
	ErrGoogleNotConnected = errors.New("google calendar is not connected")
	// ErrGoogleReauthRequired はrefresh_tokenが無い、またはGoogle側でtokenが無効と判断された場合のエラー
	ErrGoogleReauthRequired = errors.New("google reauthorization is required")
)

// CalendarTokenCipher はcalendarEventUsecaseがaccess_token/refresh_tokenの暗号化・復号に必要とする操作
type CalendarTokenCipher interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(encoded string) (string, error)
}

// CalendarEventConnectionRepository はcalendarEventUsecaseがGoogleカレンダー連携情報の取得・更新に必要とする操作
type CalendarEventConnectionRepository interface {
	FindOneByAccountID(ctx context.Context, accountID uuid.UUID) (*model.GoogleCalendarConnection, error)
	UpdateTokens(ctx context.Context, accountID uuid.UUID, accessToken string, refreshToken string, expiredAt time.Time) error
}

// GoogleTokenRefresher はcalendarEventUsecaseがrefresh_tokenによるaccess token更新に必要とする操作
type GoogleTokenRefresher interface {
	Refresh(ctx context.Context, refreshToken string) (googleauth.GoogleTokenResponse, error)
}

// GoogleCalendarProvider はcalendarEventUsecaseがGoogle Calendar APIとの通信に必要とする操作
type GoogleCalendarProvider interface {
	FindEventByFingerprint(ctx context.Context, accessToken string, fingerprint string) (*googlecalendar.CalendarEvent, error)
	CreateEvent(ctx context.Context, accessToken string, candidate model.CalendarCandidate, fingerprint string) (*googlecalendar.CalendarEvent, error)
}

// CalendarEventInfo はGoogle Calendarへ登録(または既存として検出)されたイベントの情報
type CalendarEventInfo struct {
	ID       string
	HTMLLink string
}

// CalendarEventResult はGoogle Calendarへの登録結果
type CalendarEventResult struct {
	Duplicate      bool
	ActionDecision model.ActionDecision
	Event          CalendarEventInfo
}

// CalendarEventUsecase はGoogle Calendarへの予定登録に関するユースケースを扱う
type CalendarEventUsecase struct {
	accountRepository    GoogleAuthAccountRepository
	connectionRepository CalendarEventConnectionRepository
	tokenCipher          CalendarTokenCipher
	tokenRefresher       GoogleTokenRefresher
	calendarProvider     GoogleCalendarProvider
}

func NewCalendarEventUsecase(
	accountRepository GoogleAuthAccountRepository,
	connectionRepository CalendarEventConnectionRepository,
	tokenCipher CalendarTokenCipher,
	tokenRefresher GoogleTokenRefresher,
	calendarProvider GoogleCalendarProvider,
) *CalendarEventUsecase {
	return &CalendarEventUsecase{
		accountRepository:    accountRepository,
		connectionRepository: connectionRepository,
		tokenCipher:          tokenCipher,
		tokenRefresher:       tokenRefresher,
		calendarProvider:     calendarProvider,
	}
}

// CreateEvent はauthIDに紐づくAccountのGoogleカレンダー(primary)へcandidateを予定として登録する。
// 既に同じ内容(kind/title/date/start_time)のイベントが登録済みの場合は新規作成せず、既存イベントを返す(冪等)。
// AIやFrontendから渡されたcandidateのaction_decisionは信用せず、登録可否はここで必ず再計算する。
// ActionDecisionがBLOCKEDの場合は常に拒否し、CONFIRM_REQUIREDの場合はconfirmed=trueが必要。
func (u *CalendarEventUsecase) CreateEvent(ctx context.Context, authID uuid.UUID, candidate model.CalendarCandidate, confirmed bool) (*CalendarEventResult, error) {
	if err := candidate.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrCandidateInvalid, err)
	}

	decision, reason := candidate.Decide()
	if decision == model.ActionDecisionBlocked {
		return nil, fmt.Errorf("%w: %s", ErrCandidateBlocked, reason)
	}
	if decision == model.ActionDecisionConfirmRequired && !confirmed {
		return nil, fmt.Errorf("%w: %s", ErrConfirmationRequired, reason)
	}

	account, err := u.accountRepository.FindByAuthID(ctx, authID)
	if err != nil {
		return nil, fmt.Errorf("failed to find account: %w", err)
	}

	connection, err := u.connectionRepository.FindOneByAccountID(ctx, account.ID)
	if err != nil {
		if errors.Is(err, repository.ErrGoogleCalendarConnectionNotFound) {
			return nil, ErrGoogleNotConnected
		}
		return nil, fmt.Errorf("failed to find google calendar connection: %w", err)
	}

	accessToken, err := u.resolveAccessToken(ctx, account.ID, connection)
	if err != nil {
		return nil, err
	}

	fingerprint := candidateFingerprint(candidate)

	existing, err := u.calendarProvider.FindEventByFingerprint(ctx, accessToken, fingerprint)
	if err != nil {
		return nil, u.translateProviderError(err)
	}
	if existing != nil {
		return &CalendarEventResult{
			Duplicate:      true,
			ActionDecision: decision,
			Event:          CalendarEventInfo{ID: existing.ID, HTMLLink: existing.HTMLLink},
		}, nil
	}

	created, err := u.calendarProvider.CreateEvent(ctx, accessToken, candidate, fingerprint)
	if err != nil {
		return nil, u.translateProviderError(err)
	}

	return &CalendarEventResult{
		Duplicate:      false,
		ActionDecision: decision,
		Event:          CalendarEventInfo{ID: created.ID, HTMLLink: created.HTMLLink},
	}, nil
}

// resolveAccessToken は連携情報からaccess_tokenを復号して返す。
// 有効期限が切れている、または期限間近(tokenRefreshBuffer以内)の場合はrefresh_tokenで更新し、
// 更新後のaccess_token/refresh_token/expired_atを暗号化してDBへ保存してから返す。
func (u *CalendarEventUsecase) resolveAccessToken(ctx context.Context, accountID uuid.UUID, connection *model.GoogleCalendarConnection) (string, error) {
	accessToken, err := u.tokenCipher.Decrypt(connection.AccessToken)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt access token: %w", err)
	}

	var refreshToken string
	if connection.RefreshToken != "" {
		refreshToken, err = u.tokenCipher.Decrypt(connection.RefreshToken)
		if err != nil {
			return "", fmt.Errorf("failed to decrypt refresh token: %w", err)
		}
	}

	if accessToken != "" && connection.ExpiredAt.After(time.Now().Add(tokenRefreshBuffer)) {
		return accessToken, nil
	}

	if refreshToken == "" {
		return "", ErrGoogleReauthRequired
	}

	refreshed, err := u.tokenRefresher.Refresh(ctx, refreshToken)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrGoogleReauthRequired, err)
	}

	// Googleはrefresh_tokenを再発行しないことが多いため、返されなければ既存の暗号化済み値をそのまま保持する
	newEncryptedRefreshToken := connection.RefreshToken
	if refreshed.RefreshToken != "" {
		newEncryptedRefreshToken, err = u.tokenCipher.Encrypt(refreshed.RefreshToken)
		if err != nil {
			return "", fmt.Errorf("failed to encrypt refreshed refresh token: %w", err)
		}
	}

	newEncryptedAccessToken, err := u.tokenCipher.Encrypt(refreshed.AccessToken)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt refreshed access token: %w", err)
	}

	newExpiredAt := time.Now().Add(time.Duration(refreshed.ExpiresIn) * time.Second)
	if err := u.connectionRepository.UpdateTokens(ctx, accountID, newEncryptedAccessToken, newEncryptedRefreshToken, newExpiredAt); err != nil {
		return "", fmt.Errorf("failed to save refreshed google tokens: %w", err)
	}

	return refreshed.AccessToken, nil
}

func (u *CalendarEventUsecase) translateProviderError(err error) error {
	if errors.Is(err, googlecalendar.ErrAccessTokenInvalid) {
		return ErrGoogleReauthRequired
	}
	return fmt.Errorf("failed to call google calendar api: %w", err)
}

// candidateFingerprint はcandidateの重複登録を検出するための安定した識別子を生成する。
// kind/title(正規化)/date/start_timeが一致するcandidateは同一の予定とみなす。
func candidateFingerprint(candidate model.CalendarCandidate) string {
	date := ""
	if candidate.Date != nil {
		date = *candidate.Date
	}
	startTime := ""
	if candidate.StartTime != nil {
		startTime = *candidate.StartTime
	}

	normalizedTitle := strings.ToLower(strings.TrimSpace(candidate.Title))
	raw := strings.Join([]string{string(candidate.Kind), normalizedTitle, date, startTime}, "|")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

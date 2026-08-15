package usecase

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/googleauth"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"github.com/hiro-nono/team_z/backend/internal/repository"
)

// googleAuthorizationEndpoint はGoogle OAuth 2.0の認可エンドポイント
const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"

// googleCalendarScope はGoogleカレンダー連携で要求するOAuthスコープ
const googleCalendarScope = "https://www.googleapis.com/auth/calendar.events"

// googleProvider はGoogleCalendarConnection.Providerに保存する値
const googleProvider = "google"

// GoogleAuthAccountRepository はgoogleAuthUsecaseがAuthIDからAccountIDの解決に必要とする操作
type GoogleAuthAccountRepository interface {
	FindByAuthID(ctx context.Context, authID uuid.UUID) (*model.Account, error)
}

// GoogleAuthStateCipher はgoogleAuthUsecaseがOAuth stateパラメータの暗号化/復号に必要とする操作
// stateにAccountIDを埋め込むことで、コールバック側でstate自体からAccountIDを復元できるようにし、
// サーバー側でstateとAccountIDの対応を別途保持する必要をなくす。
type GoogleAuthStateCipher interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(encoded string) (string, error)
}

// GoogleTokenExchanger はgoogleAuthUsecaseがOAuth codeのtoken交換に必要とする操作
type GoogleTokenExchanger interface {
	Exchange(ctx context.Context, code string) (googleauth.GoogleTokenResponse, error)
}

// GoogleCalendarConnectionCreator はgoogleAuthUsecaseがGoogleカレンダー連携情報の永続化に必要とする操作
type GoogleCalendarConnectionCreator interface {
	CreateGoogleCalendarConnection(
		ctx context.Context,
		accountID uuid.UUID,
		provider string,
		providerID string,
		accessToken string,
		refreshToken string,
		expiredAt time.Time,
		scope string,
	) (*model.GoogleCalendarConnection, error)
}

// GoogleAuthConnectionFinder はgoogleAuthUsecaseが接続状態の確認に必要とする操作
type GoogleAuthConnectionFinder interface {
	FindOneByAccountID(ctx context.Context, accountID uuid.UUID) (*model.GoogleCalendarConnection, error)
}

// GoogleAuthConfig はGoogle OAuth認可URL生成・token交換に必要な設定値
type GoogleAuthConfig struct {
	ClientID    string
	RedirectURI string
}

// GoogleAuthUsecase はGoogle OAuth認可フロー(開始・コールバック・接続状態確認)に関するユースケースを扱う
type GoogleAuthUsecase struct {
	accountRepository               GoogleAuthAccountRepository
	stateCipher                     GoogleAuthStateCipher
	tokenExchanger                  GoogleTokenExchanger
	googleCalendarConnectionUsecase GoogleCalendarConnectionCreator
	connectionFinder                GoogleAuthConnectionFinder
	config                          GoogleAuthConfig
}

func NewGoogleAuthUsecase(
	accountRepository GoogleAuthAccountRepository,
	stateCipher GoogleAuthStateCipher,
	tokenExchanger GoogleTokenExchanger,
	googleCalendarConnectionUsecase GoogleCalendarConnectionCreator,
	connectionFinder GoogleAuthConnectionFinder,
	config GoogleAuthConfig,
) *GoogleAuthUsecase {
	return &GoogleAuthUsecase{
		accountRepository:               accountRepository,
		stateCipher:                     stateCipher,
		tokenExchanger:                  tokenExchanger,
		googleCalendarConnectionUsecase: googleCalendarConnectionUsecase,
		connectionFinder:                connectionFinder,
		config:                          config,
	}
}

// GetConnectionStatus はauthIDに紐づくAccountにGoogleカレンダー連携情報が存在するかを返す
func (u *GoogleAuthUsecase) GetConnectionStatus(ctx context.Context, authID uuid.UUID) (bool, error) {
	account, err := u.accountRepository.FindByAuthID(ctx, authID)
	if err != nil {
		return false, fmt.Errorf("failed to find account: %w", err)
	}

	if _, err := u.connectionFinder.FindOneByAccountID(ctx, account.ID); err != nil {
		if errors.Is(err, repository.ErrGoogleCalendarConnectionNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("failed to find google calendar connection: %w", err)
	}

	return true, nil
}

// CreateAuthorizationURL はauthIDに紐づくAccountを特定し、そのAccountIDを埋め込んだstateとともに
// Google OAuth同意画面へのリダイレクト先URLを生成する
func (u *GoogleAuthUsecase) CreateAuthorizationURL(ctx context.Context, authID uuid.UUID) (string, error) {
	account, err := u.accountRepository.FindByAuthID(ctx, authID)
	if err != nil {
		return "", fmt.Errorf("failed to find account: %w", err)
	}

	state, err := u.stateCipher.Encrypt(account.ID.String())
	if err != nil {
		return "", fmt.Errorf("failed to encrypt state: %w", err)
	}

	query := url.Values{
		"client_id":              {u.config.ClientID},
		"redirect_uri":           {u.config.RedirectURI},
		"response_type":          {"code"},
		"scope":                  {googleCalendarScope},
		"access_type":            {"offline"},
		"prompt":                 {"consent"},
		"include_granted_scopes": {"true"},
		"state":                  {state},
	}

	return googleAuthorizationEndpoint + "?" + query.Encode(), nil
}

// HandleCallback はGoogle OAuthコールバックのcode/stateを受け取り、stateからAccountIDを復元した上で
// codeをtokenに交換し、GoogleCalendarConnectionとして永続化する
func (u *GoogleAuthUsecase) HandleCallback(ctx context.Context, code string, state string) error {
	accountIDString, err := u.stateCipher.Decrypt(state)
	if err != nil {
		return fmt.Errorf("failed to decrypt state: %w", err)
	}

	accountID, err := uuid.Parse(accountIDString)
	if err != nil {
		return fmt.Errorf("invalid account id in state: %w", err)
	}

	tokenResponse, err := u.tokenExchanger.Exchange(ctx, code)
	if err != nil {
		return fmt.Errorf("failed to exchange code: %w", err)
	}

	expiredAt := time.Now().Add(time.Duration(tokenResponse.ExpiresIn) * time.Second)

	// calendar.events scopeだけではGoogleのuser IDを取得しないため、providerIDはMVPでは空文字を保持する
	if _, err := u.googleCalendarConnectionUsecase.CreateGoogleCalendarConnection(
		ctx,
		accountID,
		googleProvider,
		"",
		tokenResponse.AccessToken,
		tokenResponse.RefreshToken,
		expiredAt,
		tokenResponse.Scope,
	); err != nil {
		return fmt.Errorf("failed to save google calendar connection: %w", err)
	}

	return nil
}

package googleauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// googleTokenEndpoint はGoogle OAuth 2.0のtoken交換エンドポイント
const googleTokenEndpoint = "https://oauth2.googleapis.com/token"

// GoogleTokenResponse はGoogle OAuthのcode/token交換結果
type GoogleTokenResponse struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int
	Scope        string
}

// GoogleTokenExchangeService はGoogle OAuthの認可codeをaccess token/refresh tokenに交換する
type GoogleTokenExchangeService struct {
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
}

func NewGoogleTokenExchangeService(clientID, clientSecret, redirectURI string) *GoogleTokenExchangeService {
	return &GoogleTokenExchangeService{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		httpClient:   http.DefaultClient,
	}
}

// Exchange は認可codeをGoogleのtokenエンドポイントでaccess token/refresh tokenに交換する
func (s *GoogleTokenExchangeService) Exchange(ctx context.Context, code string) (GoogleTokenResponse, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {s.clientID},
		"client_secret": {s.clientSecret},
		"redirect_uri":  {s.redirectURI},
		"grant_type":    {"authorization_code"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to build google token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to call google token api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GoogleTokenResponse{}, fmt.Errorf("google token api returned unexpected status: %d", resp.StatusCode)
	}

	var payload struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to decode google token response: %w", err)
	}
	if payload.AccessToken == "" {
		return GoogleTokenResponse{}, errors.New("google token response missing access_token")
	}

	return GoogleTokenResponse{
		AccessToken:  payload.AccessToken,
		RefreshToken: payload.RefreshToken,
		ExpiresIn:    payload.ExpiresIn,
		Scope:        payload.Scope,
	}, nil
}

// Refresh はrefresh_tokenを使ってGoogleから新しいaccess tokenを取得する。
// Googleはこのフローで通常refresh_tokenを返さないため、呼び出し側は返り値のRefreshTokenが
// 空の場合、既存のrefresh_tokenを保持すること。
func (s *GoogleTokenExchangeService) Refresh(ctx context.Context, refreshToken string) (GoogleTokenResponse, error) {
	form := url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {s.clientID},
		"client_secret": {s.clientSecret},
		"grant_type":    {"refresh_token"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to build google token refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to call google token refresh api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GoogleTokenResponse{}, fmt.Errorf("google token refresh api returned unexpected status: %d", resp.StatusCode)
	}

	var payload struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return GoogleTokenResponse{}, fmt.Errorf("failed to decode google token refresh response: %w", err)
	}
	if payload.AccessToken == "" {
		return GoogleTokenResponse{}, errors.New("google token refresh response missing access_token")
	}

	return GoogleTokenResponse{
		AccessToken:  payload.AccessToken,
		RefreshToken: payload.RefreshToken,
		ExpiresIn:    payload.ExpiresIn,
		Scope:        payload.Scope,
	}, nil
}

// GoogleOAuthService はGoogle Calendar連携のOAuthトークンをGoogle側で失効させる
type GoogleOAuthService struct {
	revokeEndpoint string
	httpClient     *http.Client
}

func NewGoogleOAuthService(revokeEndpoint string) *GoogleOAuthService {
	return &GoogleOAuthService{
		revokeEndpoint: revokeEndpoint,
		httpClient:     http.DefaultClient,
	}
}

// RevokeRefreshToken はGoogle側でRefresh Tokenを失効させる。
// 既に失効済み/無効なトークンの場合(400)も、結果としてトークンが無効という状態は
// 達成されているため冪等に成功として扱い、Jobからの再実行を安全にする。
func (s *GoogleOAuthService) RevokeRefreshToken(ctx context.Context, refreshToken string) error {
	form := url.Values{"token": {refreshToken}}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.revokeEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("failed to build google revoke request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call google revoke api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest {
		return nil
	}

	return fmt.Errorf("google revoke api returned unexpected status: %d", resp.StatusCode)
}

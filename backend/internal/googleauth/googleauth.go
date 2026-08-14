package googleauth

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

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

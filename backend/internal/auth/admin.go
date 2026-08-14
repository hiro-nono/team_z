package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"
)

// SupabaseAdminService はSupabase Auth Admin API経由でauth.usersを操作する。
// auth.usersを直接SQLで操作せず、必ずこのServiceを経由すること。
type SupabaseAdminService struct {
	projectURL     string
	serviceRoleKey string
	httpClient     *http.Client
}

func NewSupabaseAdminService(projectURL string, serviceRoleKey string) *SupabaseAdminService {
	return &SupabaseAdminService{
		projectURL:     projectURL,
		serviceRoleKey: serviceRoleKey,
		httpClient:     http.DefaultClient,
	}
}

// DeleteUser はSupabase Auth Admin API経由でauth.usersのユーザーを削除する。
// 対象ユーザーが既に存在しない場合(404)も冪等に成功として扱い、Jobからの再実行を安全にする。
func (s *SupabaseAdminService) DeleteUser(ctx context.Context, authID uuid.UUID) error {
	url := fmt.Sprintf("%s/auth/v1/admin/users/%s", s.projectURL, authID.String())

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to build supabase admin request: %w", err)
	}
	// service role keyはSupabase Admin APIの認証情報であり、ログに出力してはならない
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call supabase admin api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("supabase admin api returned unexpected status: %d", resp.StatusCode)
	}

	return nil
}

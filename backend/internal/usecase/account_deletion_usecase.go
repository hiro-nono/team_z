package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"github.com/hiro-nono/team_z/backend/internal/repository"
)

// WithdrawnAccountRepository はaccountDeletionUsecaseが削除対象Accountの取得・削除に必要とする操作
type WithdrawnAccountRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*model.Account, error)
	FindScheduledForDeletion(ctx context.Context, before time.Time) ([]*model.Account, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// AccountOAuthRepository はaccountDeletionUsecaseがGoogleカレンダー連携情報の取得・削除に必要とする操作
type AccountOAuthRepository interface {
	FindByAccountID(ctx context.Context, accountID uuid.UUID) ([]*model.GoogleCalendarConnection, error)
	DeleteByAccountID(ctx context.Context, accountID uuid.UUID) error
}

// AccountStatusLogEraser はaccountDeletionUsecaseがAccountステータス履歴の削除に必要とする操作
type AccountStatusLogEraser interface {
	DeleteByAccountID(ctx context.Context, accountID uuid.UUID) error
}

// GoogleOAuthRevoker はaccountDeletionUsecaseがGoogle側でのRefresh Token失効に必要とする操作
type GoogleOAuthRevoker interface {
	RevokeRefreshToken(ctx context.Context, refreshToken string) error
}

// SupabaseAuthAdmin はaccountDeletionUsecaseがSupabase Authユーザーの削除に必要とする操作
type SupabaseAuthAdmin interface {
	DeleteUser(ctx context.Context, authID uuid.UUID) error
}

// TokenDecrypter はaccountDeletionUsecaseが暗号化されたRefresh Tokenの復号に必要とする操作
type TokenDecrypter interface {
	Decrypt(encoded string) (string, error)
}

// AccountDeletionUsecase は退会後1か月を経過したAccountに紐づくデータの削除を扱う
type AccountDeletionUsecase struct {
	accountRepository          WithdrawnAccountRepository
	oauthRepository            AccountOAuthRepository
	accountStatusLogRepository AccountStatusLogEraser
	googleOAuthRevoker         GoogleOAuthRevoker
	supabaseAuthAdmin          SupabaseAuthAdmin
	tokenDecrypter             TokenDecrypter
	transactionManager         TransactionManager
}

func NewAccountDeletionUsecase(
	accountRepository WithdrawnAccountRepository,
	oauthRepository AccountOAuthRepository,
	accountStatusLogRepository AccountStatusLogEraser,
	googleOAuthRevoker GoogleOAuthRevoker,
	supabaseAuthAdmin SupabaseAuthAdmin,
	tokenDecrypter TokenDecrypter,
	transactionManager TransactionManager,
) *AccountDeletionUsecase {
	return &AccountDeletionUsecase{
		accountRepository:          accountRepository,
		oauthRepository:            oauthRepository,
		accountStatusLogRepository: accountStatusLogRepository,
		googleOAuthRevoker:         googleOAuthRevoker,
		supabaseAuthAdmin:          supabaseAuthAdmin,
		tokenDecrypter:             tokenDecrypter,
		transactionManager:         transactionManager,
	}
}

// DeleteScheduledAccounts は削除予定日時(WithdrawScheduledAt)を過ぎたAccountを検出し、
// 1件ずつ削除する。1件の失敗が他のAccountの削除を妨げないよう、エラーは集約して返す。
func (u *AccountDeletionUsecase) DeleteScheduledAccounts(ctx context.Context) error {
	accounts, err := u.accountRepository.FindScheduledForDeletion(ctx, time.Now())
	if err != nil {
		return fmt.Errorf("failed to find accounts scheduled for deletion: %w", err)
	}

	var errs []error
	for _, account := range accounts {
		if err := u.DeleteAccount(ctx, account.ID); err != nil {
			errs = append(errs, fmt.Errorf("failed to delete account %s: %w", account.ID, err))
		}
	}

	return errors.Join(errs...)
}

// DeleteAccount は指定したAccountとその関連データを削除する。
// 各ステップは再実行しても安全なように冪等に実装しており、途中で失敗しても
// 次回実行時に未完了のステップから再開できる。
func (u *AccountDeletionUsecase) DeleteAccount(ctx context.Context, accountID uuid.UUID) error {
	account, err := u.accountRepository.FindByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			// 既に削除済み
			return nil
		}
		return fmt.Errorf("failed to find account: %w", err)
	}

	connections, err := u.oauthRepository.FindByAccountID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to find oauth connections: %w", err)
	}

	// 1. Google Calendar OAuthのRefresh TokenをGoogle側で失効させる
	for _, connection := range connections {
		if connection.RefreshToken == "" {
			continue
		}
		refreshToken, err := u.tokenDecrypter.Decrypt(connection.RefreshToken)
		if err != nil {
			return fmt.Errorf("failed to decrypt refresh token: %w", err)
		}
		if err := u.googleOAuthRevoker.RevokeRefreshToken(ctx, refreshToken); err != nil {
			return fmt.Errorf("failed to revoke refresh token: %w", err)
		}
	}

	// 2. OAuthレコード, 3. AccountStatusLogなどAccountに紐づくデータを削除する
	err = u.transactionManager.Do(ctx, func(ctx context.Context) error {
		if err := u.oauthRepository.DeleteByAccountID(ctx, accountID); err != nil {
			return err
		}
		return u.accountStatusLogRepository.DeleteByAccountID(ctx, accountID)
	})
	if err != nil {
		return fmt.Errorf("failed to delete account related data: %w", err)
	}

	// 4. Supabase AuthのユーザーをAdmin API経由で削除する
	if err := u.supabaseAuthAdmin.DeleteUser(ctx, account.AuthID); err != nil {
		return fmt.Errorf("failed to delete supabase auth user: %w", err)
	}

	// 5. 最後にAccountを削除する
	if err := u.accountRepository.Delete(ctx, accountID); err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}

	return nil
}

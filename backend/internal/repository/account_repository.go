package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"gorm.io/gorm"
)

// ErrAccountNotFound はアカウントが見つからない場合のエラー
var ErrAccountNotFound = errors.New("account not found")

// AccountRepository はAccountの永続化を担う。呼び出し側のパッケージが
// 必要とするメソッド集合のインターフェースをそれぞれ定義して利用する。
type AccountRepository struct {
	db *gorm.DB
}

func NewAccountRepository(db *gorm.DB) *AccountRepository {
	return &AccountRepository{
		db: db,
	}
}

func (r *AccountRepository) Create(ctx context.Context, account *model.Account) error {
	if err := dbFromContext(ctx, r.db).Create(account).Error; err != nil {
		return fmt.Errorf("failed to create account: %w", err)
	}
	return nil
}

func (r *AccountRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Account, error) {
	var account model.Account
	if err := dbFromContext(ctx, r.db).First(&account, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAccountNotFound
		}
		return nil, fmt.Errorf("failed to find account: %w", err)
	}
	return &account, nil
}

// UpdateStatus はアカウントの現在ステータスを更新する
// 物理削除は行わず、退会もこのメソッドでAccountStatusWithdrawnへ更新することで対応する
func (r *AccountRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.AccountStatus) error {
	result := dbFromContext(ctx, r.db).Model(&model.Account{}).
		Where("id = ?", id).
		Update("account_status", status)
	if result.Error != nil {
		return fmt.Errorf("failed to update account status: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrAccountNotFound
	}
	return nil
}

// UpdateWithdrawScheduledAt は退会に伴うデータ削除予定日時を更新する
func (r *AccountRepository) UpdateWithdrawScheduledAt(ctx context.Context, id uuid.UUID, scheduledAt *time.Time) error {
	result := dbFromContext(ctx, r.db).Model(&model.Account{}).
		Where("id = ?", id).
		Update("withdraw_scheduled_at", scheduledAt)
	if result.Error != nil {
		return fmt.Errorf("failed to update withdraw scheduled at: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrAccountNotFound
	}
	return nil
}

// FindScheduledForDeletion は削除予定日時を過ぎた退会済みアカウントを取得する
func (r *AccountRepository) FindScheduledForDeletion(ctx context.Context, before time.Time) ([]*model.Account, error) {
	var accounts []*model.Account
	if err := dbFromContext(ctx, r.db).
		Where("account_status = ?", model.AccountStatusWithdrawn).
		Where("withdraw_scheduled_at IS NOT NULL AND withdraw_scheduled_at <= ?", before).
		Find(&accounts).Error; err != nil {
		return nil, fmt.Errorf("failed to find accounts scheduled for deletion: %w", err)
	}
	return accounts, nil
}

// Delete はAccountを物理削除する。既に存在しない場合もエラーとしない(冪等)
func (r *AccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := dbFromContext(ctx, r.db).Delete(&model.Account{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}
	return nil
}

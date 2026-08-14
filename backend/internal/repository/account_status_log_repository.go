package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"gorm.io/gorm"
)

// AccountStatusLogRepository はAccountStatusLogの永続化を担う
type AccountStatusLogRepository struct {
	db *gorm.DB
}

func NewAccountStatusLogRepository(db *gorm.DB) *AccountStatusLogRepository {
	return &AccountStatusLogRepository{
		db: db,
	}
}

func (r *AccountStatusLogRepository) Create(ctx context.Context, log *model.AccountStatusLog) error {
	if err := dbFromContext(ctx, r.db).Create(log).Error; err != nil {
		return fmt.Errorf("failed to create account status log: %w", err)
	}
	return nil
}

// DeleteByAccountID は指定したAccountに紐づくステータス履歴を全て削除する(冪等)
func (r *AccountStatusLogRepository) DeleteByAccountID(ctx context.Context, accountID uuid.UUID) error {
	if err := dbFromContext(ctx, r.db).Where("account_id = ?", accountID).Delete(&model.AccountStatusLog{}).Error; err != nil {
		return fmt.Errorf("failed to delete account status logs: %w", err)
	}
	return nil
}

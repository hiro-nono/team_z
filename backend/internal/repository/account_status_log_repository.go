package repository

import (
	"context"
	"fmt"

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

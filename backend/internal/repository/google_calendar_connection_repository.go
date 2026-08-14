package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"gorm.io/gorm"
)

// GoogleCalendarConnectionRepository はGoogleCalendarConnectionの永続化を担う
type GoogleCalendarConnectionRepository struct {
	db *gorm.DB
}

func NewGoogleCalendarConnectionRepository(db *gorm.DB) *GoogleCalendarConnectionRepository {
	return &GoogleCalendarConnectionRepository{
		db: db,
	}
}

func (r *GoogleCalendarConnectionRepository) Create(ctx context.Context, connection *model.GoogleCalendarConnection) error {
	if err := dbFromContext(ctx, r.db).Create(connection).Error; err != nil {
		return fmt.Errorf("failed to create google calendar connection: %w", err)
	}
	return nil
}

// FindByAccountID は指定したAccountに紐づくGoogleカレンダー連携情報を全て取得する
func (r *GoogleCalendarConnectionRepository) FindByAccountID(ctx context.Context, accountID uuid.UUID) ([]*model.GoogleCalendarConnection, error) {
	var connections []*model.GoogleCalendarConnection
	if err := dbFromContext(ctx, r.db).Where("account_id = ?", accountID).Find(&connections).Error; err != nil {
		return nil, fmt.Errorf("failed to find google calendar connections: %w", err)
	}
	return connections, nil
}

// DeleteByAccountID は指定したAccountに紐づくGoogleカレンダー連携情報を全て削除する(冪等)
func (r *GoogleCalendarConnectionRepository) DeleteByAccountID(ctx context.Context, accountID uuid.UUID) error {
	if err := dbFromContext(ctx, r.db).Where("account_id = ?", accountID).Delete(&model.GoogleCalendarConnection{}).Error; err != nil {
		return fmt.Errorf("failed to delete google calendar connections: %w", err)
	}
	return nil
}

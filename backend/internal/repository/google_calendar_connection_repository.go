package repository

import (
	"context"
	"fmt"

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

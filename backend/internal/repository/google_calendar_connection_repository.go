package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrGoogleCalendarConnectionNotFound は指定したAccountIDのGoogleカレンダー連携情報が存在しない場合のエラー
var ErrGoogleCalendarConnectionNotFound = errors.New("google calendar connection not found")

// GoogleCalendarConnectionRepository はGoogleCalendarConnectionの永続化を担う
type GoogleCalendarConnectionRepository struct {
	db *gorm.DB
}

func NewGoogleCalendarConnectionRepository(db *gorm.DB) *GoogleCalendarConnectionRepository {
	return &GoogleCalendarConnectionRepository{
		db: db,
	}
}

// Create はGoogleCalendarConnectionを作成する。AccountIDに既存の連携がある場合は
// 再認証とみなしaccess_token等を更新する(upsert)。ただしrefresh_tokenは、
// Googleが再認証時に返さないことがあるため、新しい値が空の場合は既存値を保持する。
func (r *GoogleCalendarConnectionRepository) Create(ctx context.Context, connection *model.GoogleCalendarConnection) error {
	err := dbFromContext(ctx, r.db).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "account_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"provider":     connection.Provider,
			"provider_id":  connection.ProviderID,
			"access_token": connection.AccessToken,
			"refresh_token": gorm.Expr(
				"CASE WHEN ? = '' THEN google_calendar_connections.refresh_token ELSE ? END",
				connection.RefreshToken, connection.RefreshToken,
			),
			"expired_at": connection.ExpiredAt,
			"scope":      connection.Scope,
			"updated_at": gorm.Expr("NOW()"),
		}),
	}).Create(connection).Error
	if err != nil {
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

// FindOneByAccountID は指定したAccountに紐づくGoogleカレンダー連携情報を1件取得する
func (r *GoogleCalendarConnectionRepository) FindOneByAccountID(ctx context.Context, accountID uuid.UUID) (*model.GoogleCalendarConnection, error) {
	var connection model.GoogleCalendarConnection
	err := dbFromContext(ctx, r.db).Where("account_id = ?", accountID).First(&connection).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrGoogleCalendarConnectionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find google calendar connection: %w", err)
	}
	return &connection, nil
}

// UpdateTokens はGoogleカレンダー連携情報のaccess_token/refresh_token/expired_atを更新する。
// Token refresh後の保存に使用する。access_token/refresh_tokenは暗号化済みの値を渡すこと。
func (r *GoogleCalendarConnectionRepository) UpdateTokens(ctx context.Context, accountID uuid.UUID, accessToken string, refreshToken string, expiredAt time.Time) error {
	err := dbFromContext(ctx, r.db).
		Model(&model.GoogleCalendarConnection{}).
		Where("account_id = ?", accountID).
		Updates(map[string]any{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"expired_at":    expiredAt,
		}).Error
	if err != nil {
		return fmt.Errorf("failed to update google calendar connection tokens: %w", err)
	}
	return nil
}

// DeleteByAccountID は指定したAccountに紐づくGoogleカレンダー連携情報を全て削除する(冪等)
func (r *GoogleCalendarConnectionRepository) DeleteByAccountID(ctx context.Context, accountID uuid.UUID) error {
	if err := dbFromContext(ctx, r.db).Where("account_id = ?", accountID).Delete(&model.GoogleCalendarConnection{}).Error; err != nil {
		return fmt.Errorf("failed to delete google calendar connections: %w", err)
	}
	return nil
}

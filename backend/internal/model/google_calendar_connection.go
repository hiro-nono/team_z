package model

import (
	"time"

	"github.com/google/uuid"
)

// Googleカレンダー連携情報
// AccessToken/RefreshTokenは平文ではなく暗号化した値を保持する
type GoogleCalendarConnection struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	AccountID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Provider     string    `gorm:"type:varchar(50);not null"`
	ProviderID   string    `gorm:"type:varchar(255);not null"`
	AccessToken  string    `gorm:"type:text;not null"`
	RefreshToken string    `gorm:"type:text"`
	ExpiredAt    time.Time
	Scope        string `gorm:"type:text"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

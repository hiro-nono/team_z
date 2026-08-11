package model

import (
	"time"

	"github.com/google/uuid"
)

// OAuth連携情報
type OAuth struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	AccountID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Provider     string    `gorm:"type:varchar(50);not null"`
	ProviderID   string    `gorm:"type:varchar(255);not null"`
	AccessToken  string    `gorm:"type:text;not null"`
	RefreshToken string    `gorm:"type:text"`
	ExpiredAt    time.Time
}

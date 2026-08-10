package model

import (
	"time"

	"github.com/google/uuid"
)

// お便り
type News struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

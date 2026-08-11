package model

import (
	"time"

	"github.com/google/uuid"
)

// 生徒情報
type Student struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	FamilyName string    `gorm:"type:varchar(100);not null"`
	GivenName  string    `gorm:"type:varchar(100);not null"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// 生徒の所属先
// 毎年度レコードを作成することで、転校・留年・進級を管理する
type StudentEnvironment struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	StudentID uuid.UUID `gorm:"type:uuid;not null;index"`
	ClassID   uuid.UUID `gorm:"type:uuid;not null;index"`
	StartAt   time.Time `gorm:"not null"`
	EndAt     time.Time // 最新所属先の場合は、nilとする
	CreatedAt time.Time
	UpdatedAt time.Time
}

// 保護者と生徒の中間テーブル
type GuardianStudent struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey"`
	GuardianAccountID uuid.UUID `gorm:"type:uuid;not null;index"` // AccountID
	StudentID         uuid.UUID `gorm:"type:uuid;not null;index"`
	CreatedAt         time.Time
}

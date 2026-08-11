package model

import (
	"time"

	"github.com/google/uuid"
)

// 学校種別
type SchoolType string

const (
	SchoolTypeElementary   SchoolType = "ELEMENTARY"
	SchoolTypeJuniorHigh   SchoolType = "JUNIOR_HIGH"
	SchoolTypeSpecialNeeds SchoolType = "SPECIAL_NEEDS"
	SchoolTypeOther        SchoolType = "OTHER"
)

// 学校情報
type School struct {
	ID         string     `gorm:"type:varchar(100);primaryKey"`
	Name       string     `gorm:"type:varchar(100);not null"`
	Type       SchoolType `gorm:"type:varchar(30);not null;index"`
	Prefecture string     `gorm:"type:varchar(100);not null"`
	City       string     `gorm:"type:varchar(100);not null"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// 先生情報
// 認証情報はAccountで管理し、先生固有の情報を保持する。
type Teacher struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	AccountID  uuid.UUID `gorm:"type:uuid;uniqueIndex;not null"`
	FamilyName string    `gorm:"type:varchar(100);not null"`
	GivenName  string    `gorm:"type:varchar(100);not null"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// 先生の学校所属の中間テーブル
// 転勤などによる所属変更を履歴として保持する。
type TeacherSchool struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey"`
	TeacherID uuid.UUID  `gorm:"type:uuid;not null;index"`
	SchoolID  uuid.UUID  `gorm:"type:uuid;not null;index"`
	StartedAt time.Time  `gorm:"not null"`
	EndedAt   *time.Time // 最新所属先の場合は、nilとする
	CreatedAt time.Time
	UpdatedAt time.Time
}

// 学校が設定する年度単位のクラス情報
type Class struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	SchoolID     uuid.UUID `gorm:"type:uuid;not null;index"`
	Grade        string    `gorm:"type:varchar(50);not null"`
	Number       int       `gorm:"not null"`                   // 表示のためのナンバリング
	Name         string    `gorm:"type:varchar(100);not null"` // クラス名（例：1年1組・A組・楓組）
	AcademicYear string    `gorm:"type:varchar(20);not null"`  // 年度
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

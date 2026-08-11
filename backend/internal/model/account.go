package model

import (
	"time"

	"github.com/google/uuid"
)

// アカウント権限
type AccountRole string

const (
	AccountRoleAdmin    AccountRole = "ADMIN"    // 管理権限
	AccountRoleGuardian AccountRole = "GUARDIAN" // 保護者権限
)

// アカウント情報
type Account struct {
	ID        uuid.UUID   `gorm:"type:uuid;primaryKey"`
	AuthID    uuid.UUID   `gorm:"type:uuid;uniqueIndex;not null"` // 認証ID
	Role      AccountRole `gorm:"type:varchar(20);not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// アカウントステータス
type AccountStatus string

const (
	AccountStatusActive    AccountStatus = "ACTIVE"    // アクティブ
	AccountStatusSuspended AccountStatus = "SUSPENDED" // 一時停止
	AccountStatusFrozen    AccountStatus = "FROZEN"    // 凍結
	AccountStatusBanned    AccountStatus = "BANNED"    // ブロック
	AccountStatusWithdrawn AccountStatus = "WITHDRAWN" // 退会
)

// アカウントステータスのイベント
type AccountEventType string

const (
	AccountEventCreated     AccountEventType = "CREATED"     // アカウント作成
	AccountEventSuspended   AccountEventType = "SUSPENDED"   // 一時停止
	AccountEventReactivated AccountEventType = "REACTIVATED" // 再有効化
	AccountEventFrozen      AccountEventType = "FROZEN"      // 凍結
	AccountEventUnfrozen    AccountEventType = "UNFROZEN"    // 解凍
	AccountEventBanned      AccountEventType = "BANNED"      // ブロック
	AccountEventWithdrawn   AccountEventType = "WITHDRAWN"   // 退会
)

// アカウントステータス履歴
// 状態を履歴として持つ
type AccountStatusLog struct {
	ID        uuid.UUID        `gorm:"type:uuid;primaryKey"`
	AccountID uuid.UUID        `gorm:"type:uuid;not null;index"`
	EventType AccountEventType `gorm:"type:varchar(20);not null"`
	Status    AccountStatus    `gorm:"type:varchar(20);not null"`
	CreatedAt time.Time
}

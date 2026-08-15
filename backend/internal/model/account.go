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
	ID                  uuid.UUID     `json:"id" gorm:"type:uuid;primaryKey"`
	AuthID              uuid.UUID     `json:"auth_id" gorm:"type:uuid;uniqueIndex;not null"` // 認証ID
	Role                AccountRole   `json:"role" gorm:"type:varchar(20);not null"`
	AccountStatus       AccountStatus `json:"account_status" gorm:"type:varchar(20);not null"`
	WithdrawScheduledAt *time.Time    `json:"withdraw_scheduled_at,omitempty" gorm:"index"` // 退会に伴うデータ削除予定日時
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
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
	ID         uuid.UUID        `gorm:"type:uuid;primaryKey"`
	AccountID  uuid.UUID        `gorm:"type:uuid;not null;index"`
	EventType  AccountEventType `gorm:"type:varchar(20);not null"`
	FromStatus AccountStatus    `gorm:"type:varchar(20)"`
	ToStatus   AccountStatus    `gorm:"type:varchar(20);not null"`
	CreatedAt  time.Time
}

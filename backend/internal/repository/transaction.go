package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type txKey struct{}

// TransactionManager は複数のRepository呼び出しを1つのDBトランザクションにまとめる
type TransactionManager struct {
	db *gorm.DB
}

func NewTransactionManager(db *gorm.DB) *TransactionManager {
	return &TransactionManager{
		db: db,
	}
}

// Do はトランザクションを開始し、fn内で発生したエラーに応じてCommit/Rollbackする
// fnにはトランザクション用のgorm.DBが埋め込まれたctxが渡される
func (m *TransactionManager) Do(ctx context.Context, fn func(ctx context.Context) error) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(context.WithValue(ctx, txKey{}, tx))
	})
	if err != nil {
		return fmt.Errorf("transaction failed: %w", err)
	}
	return nil
}

// dbFromContext はctxにトランザクション用のgorm.DBがあればそれを、なければdefaultDBを返す
func dbFromContext(ctx context.Context, defaultDB *gorm.DB) *gorm.DB {
	if tx, ok := ctx.Value(txKey{}).(*gorm.DB); ok {
		return tx.WithContext(ctx)
	}
	return defaultDB.WithContext(ctx)
}

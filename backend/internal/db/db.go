package db

import (
	"fmt"

	"github.com/hiro-nono/team_z/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// NewDB はSupabase PostgreSQLへのgorm接続を生成する
func NewDB(cfg *config.Config) (*gorm.DB, error) {
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	return db, nil
}

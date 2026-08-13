package config

import "os"

type Config struct {
	SupabaseURL        string
	DatabaseURL        string
	TokenEncryptionKey string
}

func Load() *Config {
	return &Config{
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		TokenEncryptionKey: os.Getenv("TOKEN_ENCRYPTION_KEY"),
	}
}

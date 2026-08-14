package config

import "os"

type Config struct {
	SupabaseURL            string
	SupabaseServiceRoleKey string
	DatabaseURL            string
	TokenEncryptionKey     string
	GoogleOAuthRevokeURL   string
}

func Load() *Config {
	return &Config{
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		TokenEncryptionKey:     os.Getenv("TOKEN_ENCRYPTION_KEY"),
		GoogleOAuthRevokeURL:   os.Getenv("GOOGLE_OAUTH_REVOKE_URL"),
	}
}

package config

import "os"

type Config struct {
	SupabaseURL string
	DatabaseURL string
}

func Load() *Config {
	return &Config{
		SupabaseURL: os.Getenv("SUPABASE_URL"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
}

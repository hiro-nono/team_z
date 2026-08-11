package config

import "os"

type Config struct {
	SupabaseURL string
}

func Load() *Config {
	return &Config{
		SupabaseURL: os.Getenv("SUPABASE_URL"),
	}
}

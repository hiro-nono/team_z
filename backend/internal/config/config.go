package config

import "os"

type Config struct {
	Port                   string
	SupabaseURL            string
	SupabaseServiceRoleKey string
	DatabaseURL            string
	TokenEncryptionKey     string
	GoogleOAuthRevokeURL   string
	GoogleClientID         string
	GoogleClientSecret     string
	GoogleRedirectURI      string
	FrontendURL            string
	OrcaRouterBaseURL      string
	OrcaRouterAPIKey       string
	OrcaRouterModel        string
}

func Load() *Config {
	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8080"
	}

	orcaRouterBaseURL := os.Getenv("ORCAROUTER_BASE_URL")
	if orcaRouterBaseURL == "" {
		orcaRouterBaseURL = "https://api.orcarouter.ai/v1"
	}

	orcaRouterModel := os.Getenv("ORCAROUTER_MODEL")
	if orcaRouterModel == "" {
		orcaRouterModel = "openai/gpt-4o-mini"
	}

	return &Config{
		Port:                   port,
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		TokenEncryptionKey:     os.Getenv("TOKEN_ENCRYPTION_KEY"),
		GoogleOAuthRevokeURL:   os.Getenv("GOOGLE_OAUTH_REVOKE_URL"),
		GoogleClientID:         os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:     os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURI:      os.Getenv("GOOGLE_REDIRECT_URI"),
		FrontendURL:            os.Getenv("FRONTEND_URL"),
		OrcaRouterBaseURL:      orcaRouterBaseURL,
		OrcaRouterAPIKey:       os.Getenv("ORCAROUTER_API_KEY"),
		OrcaRouterModel:        orcaRouterModel,
	}
}

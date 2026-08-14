package main

import (
	"context"
	"log"
	"time"

	"github.com/hiro-nono/team_z/backend/internal/auth"
	"github.com/hiro-nono/team_z/backend/internal/config"
	"github.com/hiro-nono/team_z/backend/internal/controller"
	"github.com/hiro-nono/team_z/backend/internal/crypto"
	"github.com/hiro-nono/team_z/backend/internal/db"
	"github.com/hiro-nono/team_z/backend/internal/googleauth"
	"github.com/hiro-nono/team_z/backend/internal/job"
	"github.com/hiro-nono/team_z/backend/internal/middleware"
	"github.com/hiro-nono/team_z/backend/internal/repository"
	"github.com/hiro-nono/team_z/backend/internal/router"
	"github.com/hiro-nono/team_z/backend/internal/usecase"
)

// accountDeletionJobInterval は退会済みAccountの削除Jobを実行する間隔
const accountDeletionJobInterval = 1 * time.Hour

func main() {
	cfg := config.Load()

	database, err := db.NewDB(cfg)
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}

	tokenCipher, err := crypto.NewTokenCipher(cfg.TokenEncryptionKey)
	if err != nil {
		log.Fatalf("failed to initialize token cipher: %v", err)
	}

	accountRepository := repository.NewAccountRepository(database)
	accountStatusLogRepository := repository.NewAccountStatusLogRepository(database)
	transactionManager := repository.NewTransactionManager(database)
	accountUsecase := usecase.NewAccountUsecase(accountRepository, accountStatusLogRepository, transactionManager)
	accountController := controller.NewAccountController(accountUsecase)
	csrfController := controller.NewCSRFController()

	googleCalendarConnectionRepository := repository.NewGoogleCalendarConnectionRepository(database)
	googleCalendarConnectionUsecase := usecase.NewGoogleCalendarConnectionUsecase(googleCalendarConnectionRepository, tokenCipher)
	googleCalendarConnectionController := controller.NewGoogleCalendarConnectionController(googleCalendarConnectionUsecase)

	authService := auth.NewAuthService(cfg.SupabaseURL)
	authMiddleware := middleware.NewAuthMiddleware(authService)

	googleOAuthService := googleauth.NewGoogleOAuthService(cfg.GoogleOAuthRevokeURL)
	supabaseAdminService := auth.NewSupabaseAdminService(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	accountDeletionUsecase := usecase.NewAccountDeletionUsecase(
		accountRepository,
		googleCalendarConnectionRepository,
		accountStatusLogRepository,
		googleOAuthService,
		supabaseAdminService,
		tokenCipher,
		transactionManager,
	)
	accountDeletionJob := job.NewAccountDeletionJob(accountDeletionUsecase, accountDeletionJobInterval)
	go accountDeletionJob.Start(context.Background())

	engine := router.NewRouter(accountController, csrfController, googleCalendarConnectionController, authMiddleware)

	if err := engine.Run(); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

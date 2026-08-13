package main

import (
	"log"

	"github.com/hiro-nono/team_z/backend/internal/config"
	"github.com/hiro-nono/team_z/backend/internal/controller"
	"github.com/hiro-nono/team_z/backend/internal/crypto"
	"github.com/hiro-nono/team_z/backend/internal/db"
	"github.com/hiro-nono/team_z/backend/internal/repository"
	"github.com/hiro-nono/team_z/backend/internal/router"
	"github.com/hiro-nono/team_z/backend/internal/usecase"
)

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

	engine := router.NewRouter(accountController, csrfController, googleCalendarConnectionController)

	if err := engine.Run(); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

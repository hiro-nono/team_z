package main

import (
	"log"

	"github.com/hiro-nono/team_z/backend/internal/config"
	"github.com/hiro-nono/team_z/backend/internal/controller"
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

	accountRepository := repository.NewAccountRepository(database)
	accountStatusLogRepository := repository.NewAccountStatusLogRepository(database)
	transactionManager := repository.NewTransactionManager(database)
	accountUsecase := usecase.NewAccountUsecase(accountRepository, accountStatusLogRepository, transactionManager)
	accountController := controller.NewAccountController(accountUsecase)
	csrfController := controller.NewCSRFController()

	engine := router.NewRouter(accountController, csrfController)

	if err := engine.Run(); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

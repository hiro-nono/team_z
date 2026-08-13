package router

import (
	"github.com/gin-gonic/gin"
)

// AccountHandler はrouterがAccount関連エンドポイントの登録に必要とするハンドラ群
type AccountHandler interface {
	Create(c *gin.Context)
	Get(c *gin.Context)
	Withdraw(c *gin.Context)
	ChangeStatus(c *gin.Context)
}

// CSRFHandler はrouterがCSRFトークン発行エンドポイントの登録に必要とするハンドラ群
type CSRFHandler interface {
	IssueToken(c *gin.Context)
}

// GoogleCalendarConnectionHandler はrouterがGoogleカレンダー連携情報関連エンドポイントの登録に必要とするハンドラ群
type GoogleCalendarConnectionHandler interface {
	Create(c *gin.Context)
}

// NewRouter はアプリケーションの全エンドポイントを登録したgin.Engineを生成する
func NewRouter(accountController AccountHandler, csrfController CSRFHandler, googleCalendarConnectionController GoogleCalendarConnectionHandler) *gin.Engine {
	engine := gin.Default()

	engine.GET("/csrf-token", csrfController.IssueToken)

	accounts := engine.Group("/accounts")
	{
		accounts.POST("", accountController.Create)
		accounts.GET("/:id", accountController.Get)
		accounts.DELETE("/:id", accountController.Withdraw)
		accounts.PATCH("/:id/status", accountController.ChangeStatus)
	}

	googleCalendarConnections := engine.Group("/google-calendar-connections")
	{
		googleCalendarConnections.POST("", googleCalendarConnectionController.Create)
	}

	return engine
}

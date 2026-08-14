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

// AuthMiddleware はrouterが認証必須エンドポイントの保護に必要とするミドルウェア
type AuthMiddleware interface {
	Handler() gin.HandlerFunc
}

// NewRouter はアプリケーションの全エンドポイントを登録したgin.Engineを生成する
func NewRouter(accountController AccountHandler, csrfController CSRFHandler, googleCalendarConnectionController GoogleCalendarConnectionHandler, authMiddleware AuthMiddleware) *gin.Engine {
	engine := gin.Default()

	engine.GET("/csrf-token", csrfController.IssueToken)

	// アカウント作成はSupabaseサインアップ直後、まだ本人のアカウントが存在しない段階で呼ばれるため認証不要
	accounts := engine.Group("/accounts")
	{
		accounts.POST("", accountController.Create)
	}

	// 既存アカウントを操作するエンドポイントは認証必須
	accountsAuthed := engine.Group("/accounts", authMiddleware.Handler())
	{
		accountsAuthed.GET("/:id", accountController.Get)
		accountsAuthed.DELETE("/:id", accountController.Withdraw)
		accountsAuthed.PATCH("/:id/status", accountController.ChangeStatus)
	}

	googleCalendarConnections := engine.Group("/google-calendar-connections", authMiddleware.Handler())
	{
		googleCalendarConnections.POST("", googleCalendarConnectionController.Create)
	}

	return engine
}

package router

import (
	"github.com/gin-gonic/gin"
	"github.com/hiro-nono/team_z/backend/internal/middleware"
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

// GoogleAuthHandler はrouterがGoogle OAuth認可フロー関連エンドポイントの登録に必要とするハンドラ群
type GoogleAuthHandler interface {
	Start(c *gin.Context)
	Callback(c *gin.Context)
	Status(c *gin.Context)
}

// AnalyzeHandler はrouterがPDF解析エンドポイントの登録に必要とするハンドラ群
type AnalyzeHandler interface {
	Analyze(c *gin.Context)
}

// CalendarEventHandler はrouterがGoogle Calendar予定登録エンドポイントの登録に必要とするハンドラ群
type CalendarEventHandler interface {
	Create(c *gin.Context)
}

// AuthMiddleware はrouterが認証必須エンドポイントの保護に必要とするミドルウェア
type AuthMiddleware interface {
	Handler() gin.HandlerFunc
}

// NewRouter はアプリケーションの全エンドポイントを登録したgin.Engineを生成する
func NewRouter(accountController AccountHandler, csrfController CSRFHandler, googleCalendarConnectionController GoogleCalendarConnectionHandler, googleAuthController GoogleAuthHandler, analyzeController AnalyzeHandler, calendarEventController CalendarEventHandler, authMiddleware AuthMiddleware) *gin.Engine {
	engine := gin.Default()
	engine.Use(middleware.CORSMiddleware())

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

	// コールバックはGoogleからのブラウザリダイレクトで呼ばれるため認証不要
	// (AccountIDはstateパラメータから復元する)
	googleAuth := engine.Group("/api/google")
	{
		googleAuth.POST("/auth/start", authMiddleware.Handler(), googleAuthController.Start)
		googleAuth.GET("/auth/callback", googleAuthController.Callback)
		googleAuth.GET("/status", authMiddleware.Handler(), googleAuthController.Status)
	}

	// PDF解析はGoogle Calendar登録を伴わない読み取り専用処理のため認証不要
	engine.POST("/api/analyze", analyzeController.Analyze)

	// Google Calendarへの予定登録はAccountに紐づくtokenを扱うため認証必須
	// (AccountIDはrequest bodyではなく認証middlewareが設定したauth_user_idから解決する)
	calendarEvents := engine.Group("/api/calendar", authMiddleware.Handler())
	{
		calendarEvents.POST("/events", calendarEventController.Create)
	}

	return engine
}

package controller

import (
	"context"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GoogleAuthUsecase はGoogleAuthControllerがGoogle OAuth認可フローの処理に必要とする操作
type GoogleAuthUsecase interface {
	CreateAuthorizationURL(ctx context.Context, authID uuid.UUID) (string, error)
	HandleCallback(ctx context.Context, code string, state string) error
	GetConnectionStatus(ctx context.Context, authID uuid.UUID) (bool, error)
}

type GoogleAuthController struct {
	googleAuthUsecase GoogleAuthUsecase
	frontendURL       string
}

func NewGoogleAuthController(googleAuthUsecase GoogleAuthUsecase, frontendURL string) *GoogleAuthController {
	return &GoogleAuthController{
		googleAuthUsecase: googleAuthUsecase,
		frontendURL:       frontendURL,
	}
}

type startGoogleAuthResponse struct {
	URL string `json:"url"`
}

type googleConnectionStatusResponse struct {
	Connected bool `json:"connected"`
}

// resolveAuthID はGinコンテキストにセットされたauth_user_id(JWTのsub)をuuid.UUIDとして取得する
func resolveAuthID(c *gin.Context) (uuid.UUID, bool) {
	rawAuthID, exists := c.Get("auth_user_id")
	if !exists {
		return uuid.UUID{}, false
	}

	authIDString, ok := rawAuthID.(string)
	if !ok {
		return uuid.UUID{}, false
	}

	authID, err := uuid.Parse(authIDString)
	if err != nil {
		return uuid.UUID{}, false
	}

	return authID, true
}

// Start はリクエストしたユーザーのAccountIDをもとにGoogle OAuth同意画面へのリダイレクト先URLを返す
// AccountIDはリクエストヘッダー(Authorization)のJWTから取得したAuthIDをもとにDBから解決する
func (h *GoogleAuthController) Start(c *gin.Context) {
	authID, ok := resolveAuthID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	authorizationURL, err := h.googleAuthUsecase.CreateAuthorizationURL(c.Request.Context(), authID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create authorization url"})
		return
	}

	c.JSON(http.StatusOK, startGoogleAuthResponse{URL: authorizationURL})
}

// Status はリクエストしたユーザーのAccountにGoogleカレンダー連携が設定済みかどうかを返す
func (h *GoogleAuthController) Status(c *gin.Context) {
	authID, ok := resolveAuthID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	connected, err := h.googleAuthUsecase.GetConnectionStatus(c.Request.Context(), authID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get connection status"})
		return
	}

	c.JSON(http.StatusOK, googleConnectionStatusResponse{Connected: connected})
}

// Callback はGoogleからのOAuthリダイレクトを受け取り、codeをtokenに交換して
// GoogleCalendarConnectionを保存した後、Frontendへリダイレクトする
// ブラウザの通常ナビゲーションとして呼ばれるためAuthorizationヘッダーは付与されない
func (h *GoogleAuthController) Callback(c *gin.Context) {
	if oauthError := c.Query("error"); oauthError != "" {
		h.redirectToFrontend(c, "error", "oauth_denied")
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		h.redirectToFrontend(c, "error", "callback_invalid")
		return
	}

	if err := h.googleAuthUsecase.HandleCallback(c.Request.Context(), code, state); err != nil {
		h.redirectToFrontend(c, "error", "oauth_failed")
		return
	}

	h.redirectToFrontend(c, "connected", "")
}

func (h *GoogleAuthController) redirectToFrontend(c *gin.Context, status string, reason string) {
	target, err := url.Parse(h.frontendURL)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	query := target.Query()
	query.Set("google", status)
	if reason != "" {
		query.Set("reason", reason)
	}
	target.RawQuery = query.Encode()

	c.Redirect(http.StatusFound, target.String())
}

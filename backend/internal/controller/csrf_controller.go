package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hiro-nono/team_z/backend/internal/csrf"
)

// CSRFCookieName はCSRFトークンを保持するCookie名
const CSRFCookieName = "csrf_token"

// csrfCookieMaxAge はCSRFトークンCookieの有効期間(秒)
const csrfCookieMaxAge = 60 * 60

type CSRFController struct{}

func NewCSRFController() *CSRFController {
	return &CSRFController{}
}

// IssueToken はCSRFトークンを生成し、Cookieへ設定したうえでレスポンスとして返却する
func (h *CSRFController) IssueToken(c *gin.Context) {
	token, err := csrf.GenerateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate csrf token"})
		return
	}

	secure := gin.Mode() == gin.ReleaseMode
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(CSRFCookieName, token, csrfCookieMaxAge, "/", "", secure, true)

	c.JSON(http.StatusOK, gin.H{"csrf_token": token})
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hiro-nono/team_z/backend/internal/auth"
)

// Authenticator はAuthMiddlewareがリクエストの認証に必要とする操作
type Authenticator interface {
	VerifyToken(token string) (*auth.AuthUser, error)
}

type AuthMiddleware struct {
	authService Authenticator
}

func NewAuthMiddleware(authService Authenticator) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
	}
}

func (am *AuthMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Authorization Header取得
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(401, gin.H{
				"error": "unauthorized",
			})
			c.Abort()
			return
		}

		// トークンの確認
		parts := strings.SplitN(token, " ", 2)

		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization header",
			})
			return
		}

		// 検証
		authUser, err := am.authService.VerifyToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token",
			})
			return
		}
		// Contextへユーザー情報を保存
		c.Set("auth_user_id", authUser.ID)

		c.Next()
	}
}

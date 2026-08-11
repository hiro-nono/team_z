package auth

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

type AuthUser struct {
	ID string
}

type IAuth interface {
	VerifyToken(token string) (*AuthUser, error)
}

type authHandler struct {
	projectURL string
	jwksURL    string
}

func NewAuthService(projectURL string) IAuth {
	return &authHandler{
		projectURL: projectURL,
		jwksURL:    projectURL + "/auth/v1/.well-known/jwks.json",
	}
}

func (ah *authHandler) VerifyToken(token string) (*AuthUser, error) {
	// JWT検証
	parsedToken, err := jwt.Parse(
		token,
		func(token *jwt.Token) (interface{}, error) {
			// 署名アルゴリズムを確認
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf(
					"unexpected signing method: %v",
					token.Header["alg"],
				)
			}

			// TODO:
			// JWKSからkidに対応する公開鍵を取得する
			return nil, errors.New("JWKS verification is not implemented")
		},
		jwt.WithIssuer(ah.projectURL+"/auth/v1"),
		jwt.WithAudience("authenticated"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}

	// Supabase Auth User ID取得
	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("failed to parse token claims")
	}

	id, ok := claims["sub"].(string)
	if !ok {
		return nil, errors.New("sub claim not found in token")
	}

	return &AuthUser{
		ID: id,
	}, nil
}

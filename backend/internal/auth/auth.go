package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AuthUser struct {
	ID string
}

// jwksCacheTTL はJWKSの再取得までのキャッシュ有効期間
const jwksCacheTTL = 1 * time.Hour

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksResponse struct {
	Keys []jwk `json:"keys"`
}

// AuthService はSupabase Authが発行したJWTの検証を行う
// SupabaseはJWT署名鍵にES256(ECDSA/P-256)を使用するため、JWKSもEC鍵として解釈する
type AuthService struct {
	projectURL string
	jwksURL    string
	httpClient *http.Client

	mu         sync.Mutex
	cachedKeys map[string]*ecdsa.PublicKey
	fetchedAt  time.Time
}

func NewAuthService(projectURL string) *AuthService {
	return &AuthService{
		projectURL: projectURL,
		jwksURL:    projectURL + "/auth/v1/.well-known/jwks.json",
		httpClient: http.DefaultClient,
	}
}

func (ah *AuthService) VerifyToken(token string) (*AuthUser, error) {
	// JWT検証
	parsedToken, err := jwt.Parse(
		token,
		func(token *jwt.Token) (any, error) {
			// 署名アルゴリズムを確認
			if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
				return nil, fmt.Errorf(
					"unexpected signing method: %v",
					token.Header["alg"],
				)
			}

			kid, ok := token.Header["kid"].(string)
			if !ok || kid == "" {
				return nil, errors.New("kid not found in token header")
			}

			// JWKSからkidに対応する公開鍵を取得する
			return ah.publicKey(kid)
		},
		jwt.WithIssuer(ah.projectURL+"/auth/v1"),
		jwt.WithAudience("authenticated"),
		jwt.WithValidMethods([]string{"ES256"}),
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

// publicKey はkidに対応する公開鍵をキャッシュから返す。キャッシュに無い場合はJWKSを再取得する。
func (ah *AuthService) publicKey(kid string) (*ecdsa.PublicKey, error) {
	ah.mu.Lock()
	defer ah.mu.Unlock()

	if key, ok := ah.cachedKeys[kid]; ok && time.Since(ah.fetchedAt) < jwksCacheTTL {
		return key, nil
	}

	keys, err := ah.fetchJWKS()
	if err != nil {
		return nil, err
	}
	ah.cachedKeys = keys
	ah.fetchedAt = time.Now()

	key, ok := keys[kid]
	if !ok {
		return nil, fmt.Errorf("no matching jwk found for kid: %s", kid)
	}
	return key, nil
}

func (ah *AuthService) fetchJWKS() (map[string]*ecdsa.PublicKey, error) {
	resp, err := ah.httpClient.Get(ah.jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch jwks: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks endpoint returned unexpected status: %d", resp.StatusCode)
	}

	var payload jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("failed to decode jwks response: %w", err)
	}

	keys := make(map[string]*ecdsa.PublicKey, len(payload.Keys))
	for _, k := range payload.Keys {
		if k.Kty != "EC" || k.Crv != "P-256" {
			continue
		}
		publicKey, err := parseECPublicKey(k)
		if err != nil {
			continue
		}
		keys[k.Kid] = publicKey
	}

	return keys, nil
}

func parseECPublicKey(k jwk) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
	if err != nil {
		return nil, fmt.Errorf("failed to decode jwk x: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
	if err != nil {
		return nil, fmt.Errorf("failed to decode jwk y: %w", err)
	}

	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}

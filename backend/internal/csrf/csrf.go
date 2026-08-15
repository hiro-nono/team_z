package csrf

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// tokenLength はCSRFトークンの生成に使う乱数バイト長
const tokenLength = 32

// GenerateToken は暗号学的に安全な乱数からCSRFトークンを生成する
func GenerateToken() (string, error) {
	b := make([]byte, tokenLength)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate csrf token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

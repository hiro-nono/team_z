package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// TokenCipher はAES-256-GCMでアクセストークン等の機密情報を暗号化/復号する
type TokenCipher struct {
	gcm cipher.AEAD
}

// NewTokenCipher はbase64エンコードされた32バイトの鍵からTokenCipherを生成する
// 鍵は呼び出し元(main等)で環境変数から読み込んで渡すこと。ソースコードへの鍵のハードコードは禁止。
func NewTokenCipher(base64Key string) (*TokenCipher, error) {
	if base64Key == "" {
		return nil, errors.New("encryption key is not set")
	}

	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes when decoded, got %d bytes", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create gcm: %w", err)
	}

	return &TokenCipher{gcm: gcm}, nil
}

// Encrypt は平文を暗号化し、base64エンコードした文字列を返す
func (c *TokenCipher) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := c.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt はEncryptで暗号化された文字列を復号する
func (c *TokenCipher) Decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	nonceSize := c.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext is too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := c.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt ciphertext: %w", err)
	}

	return string(plaintext), nil
}

package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
)

// TokenCipher はgoogleCalendarConnectionUsecaseがAccessToken/RefreshTokenの暗号化に必要とする操作
type TokenCipher interface {
	Encrypt(plaintext string) (string, error)
}

// GoogleCalendarConnectionRepository はgoogleCalendarConnectionUsecaseがGoogleCalendarConnectionの永続化に必要とする操作
type GoogleCalendarConnectionRepository interface {
	Create(ctx context.Context, connection *model.GoogleCalendarConnection) error
}

// GoogleCalendarConnectionUsecase はGoogleカレンダー連携情報に関するユースケースを扱う
type GoogleCalendarConnectionUsecase struct {
	googleCalendarConnectionRepository GoogleCalendarConnectionRepository
	tokenCipher                        TokenCipher
}

func NewGoogleCalendarConnectionUsecase(
	googleCalendarConnectionRepository GoogleCalendarConnectionRepository,
	tokenCipher TokenCipher,
) *GoogleCalendarConnectionUsecase {
	return &GoogleCalendarConnectionUsecase{
		googleCalendarConnectionRepository: googleCalendarConnectionRepository,
		tokenCipher:                        tokenCipher,
	}
}

// CreateGoogleCalendarConnection はGoogleカレンダー連携情報を作成する
// AccessToken/RefreshTokenは平文のまま永続化せず、TokenCipherで暗号化してから保存する
func (u *GoogleCalendarConnectionUsecase) CreateGoogleCalendarConnection(
	ctx context.Context,
	accountID uuid.UUID,
	provider string,
	providerID string,
	accessToken string,
	refreshToken string,
	expiredAt time.Time,
	scope string,
) (*model.GoogleCalendarConnection, error) {
	encryptedAccessToken, err := u.tokenCipher.Encrypt(accessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt access token: %w", err)
	}

	var encryptedRefreshToken string
	if refreshToken != "" {
		encryptedRefreshToken, err = u.tokenCipher.Encrypt(refreshToken)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt refresh token: %w", err)
		}
	}

	connection := &model.GoogleCalendarConnection{
		ID:           uuid.New(),
		AccountID:    accountID,
		Provider:     provider,
		ProviderID:   providerID,
		AccessToken:  encryptedAccessToken,
		RefreshToken: encryptedRefreshToken,
		ExpiredAt:    expiredAt,
		Scope:        scope,
	}

	if err := u.googleCalendarConnectionRepository.Create(ctx, connection); err != nil {
		return nil, fmt.Errorf("failed to create google calendar connection: %w", err)
	}

	return connection, nil
}

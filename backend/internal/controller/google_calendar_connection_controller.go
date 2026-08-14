package controller

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
)

// GoogleCalendarConnectionUsecase はGoogleCalendarConnectionControllerがGoogleカレンダー連携情報の作成に必要とする操作
type GoogleCalendarConnectionUsecase interface {
	CreateGoogleCalendarConnection(
		ctx context.Context,
		accountID uuid.UUID,
		provider string,
		providerID string,
		accessToken string,
		refreshToken string,
		expiredAt time.Time,
		scope string,
	) (*model.GoogleCalendarConnection, error)
}

type GoogleCalendarConnectionController struct {
	googleCalendarConnectionUsecase GoogleCalendarConnectionUsecase
}

func NewGoogleCalendarConnectionController(googleCalendarConnectionUsecase GoogleCalendarConnectionUsecase) *GoogleCalendarConnectionController {
	return &GoogleCalendarConnectionController{
		googleCalendarConnectionUsecase: googleCalendarConnectionUsecase,
	}
}

type createGoogleCalendarConnectionRequest struct {
	AccountID    uuid.UUID `json:"account_id" binding:"required"`
	Provider     string    `json:"provider" binding:"required"`
	ProviderID   string    `json:"provider_id" binding:"required"`
	AccessToken  string    `json:"access_token" binding:"required"`
	RefreshToken string    `json:"refresh_token"`
	ExpiredAt    time.Time `json:"expired_at"`
	Scope        string    `json:"scope"`
}

func (h *GoogleCalendarConnectionController) Create(c *gin.Context) {
	var req createGoogleCalendarConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	connection, err := h.googleCalendarConnectionUsecase.CreateGoogleCalendarConnection(
		c.Request.Context(),
		req.AccountID,
		req.Provider,
		req.ProviderID,
		req.AccessToken,
		req.RefreshToken,
		req.ExpiredAt,
		req.Scope,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create google calendar connection"})
		return
	}

	c.JSON(http.StatusCreated, connection)
}

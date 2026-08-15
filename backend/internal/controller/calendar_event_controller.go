package controller

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"github.com/hiro-nono/team_z/backend/internal/repository"
	"github.com/hiro-nono/team_z/backend/internal/usecase"
)

// CalendarEventUsecase はCalendarEventControllerがGoogle Calendarへの予定登録に必要とする操作
type CalendarEventUsecase interface {
	CreateEvent(ctx context.Context, authID uuid.UUID, candidate model.CalendarCandidate, confirmed bool) (*usecase.CalendarEventResult, error)
}

type CalendarEventController struct {
	calendarEventUsecase CalendarEventUsecase
}

func NewCalendarEventController(calendarEventUsecase CalendarEventUsecase) *CalendarEventController {
	return &CalendarEventController{
		calendarEventUsecase: calendarEventUsecase,
	}
}

type createCalendarEventRequest struct {
	Candidate model.CalendarCandidate `json:"candidate" binding:"required"`
	// Confirmed はActionDecisionがCONFIRM_REQUIREDの候補をユーザーが確認済みであることを示す
	Confirmed bool `json:"confirmed"`
}

type createCalendarEventResponse struct {
	Duplicate      bool                  `json:"duplicate"`
	ActionDecision model.ActionDecision  `json:"action_decision"`
	Event          calendarEventResponse `json:"event"`
}

type calendarEventResponse struct {
	ID       string `json:"id"`
	HTMLLink string `json:"htmlLink"`
}

// Create はリクエストしたユーザーのAccountに紐づくGoogle Calendar(primary)へ、
// request bodyのcandidateを1件の予定として登録する。
// AccountIDはrequest bodyから受け取らず、リクエストヘッダー(Authorization)のJWTから取得したAuthIDをもとに解決する。
func (h *CalendarEventController) Create(c *gin.Context) {
	rawAuthID, exists := c.Get("auth_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	authIDString, ok := rawAuthID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	authID, err := uuid.Parse(authIDString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user id"})
		return
	}

	var req createCalendarEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.calendarEventUsecase.CreateEvent(c.Request.Context(), authID, req.Candidate, req.Confirmed)
	if err != nil {
		h.respondCreateEventError(c, err)
		return
	}

	c.JSON(http.StatusOK, createCalendarEventResponse{
		Duplicate:      result.Duplicate,
		ActionDecision: result.ActionDecision,
		Event: calendarEventResponse{
			ID:       result.Event.ID,
			HTMLLink: result.Event.HTMLLink,
		},
	})
}

// respondCreateEventError はGoogle Calendar登録処理で発生したエラーを、詳細を漏らさない
// 適切なHTTPエラーへ変換する。Google Calendar APIからのレスポンスをそのままFrontendへ返すことはしない。
func (h *CalendarEventController) respondCreateEventError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, usecase.ErrCandidateInvalid), errors.Is(err, usecase.ErrCandidateBlocked):
		c.JSON(http.StatusBadRequest, gin.H{"error": "candidate is invalid"})
	case errors.Is(err, usecase.ErrConfirmationRequired):
		c.JSON(http.StatusBadRequest, gin.H{"error": "candidate requires confirmation"})
	case errors.Is(err, repository.ErrAccountNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
	case errors.Is(err, usecase.ErrGoogleNotConnected):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "google calendar is not connected"})
	case errors.Is(err, usecase.ErrGoogleReauthRequired):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "google reauthorization is required"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create calendar event"})
	}
}

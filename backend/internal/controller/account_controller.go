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

// AccountUsecase はAccountControllerがAccountに関する処理の実行に必要とする操作
type AccountUsecase interface {
	CreateAccount(ctx context.Context, authID uuid.UUID) (*model.Account, error)
	GetAccount(ctx context.Context, id uuid.UUID) (*model.Account, error)
	WithdrawAccount(ctx context.Context, id uuid.UUID) error
	ChangeAccountStatus(ctx context.Context, accountID uuid.UUID, actorAccountID uuid.UUID, eventType model.AccountEventType) (*model.AccountStatusLog, error)
}

type AccountController struct {
	accountUsecase AccountUsecase
}

func NewAccountController(accountUsecase AccountUsecase) *AccountController {
	return &AccountController{
		accountUsecase: accountUsecase,
	}
}

type createAccountRequest struct {
	AuthID uuid.UUID `json:"auth_id" binding:"required"`
}

type changeAccountStatusRequest struct {
	ActorAccountID uuid.UUID              `json:"actor_account_id" binding:"required"`
	EventType      model.AccountEventType `json:"event_type" binding:"required"`
}

func (h *AccountController) Create(c *gin.Context) {
	var req createAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	account, err := h.accountUsecase.CreateAccount(c.Request.Context(), req.AuthID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create account"})
		return
	}

	c.JSON(http.StatusCreated, account)
}

func (h *AccountController) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account id"})
		return
	}

	account, err := h.accountUsecase.GetAccount(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get account"})
		return
	}

	c.JSON(http.StatusOK, account)
}

// Withdraw はアカウントを論理削除する(退会)。物理削除は行わない。
func (h *AccountController) Withdraw(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account id"})
		return
	}

	if err := h.accountUsecase.WithdrawAccount(c.Request.Context(), id); err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to withdraw account"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ChangeStatus は退会以外のステータスイベントを記録する。Admin権限を持つactor_account_idが必要。
func (h *AccountController) ChangeStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account id"})
		return
	}

	var req changeAccountStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log, err := h.accountUsecase.ChangeAccountStatus(c.Request.Context(), id, req.ActorAccountID, req.EventType)
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrPermissionDenied):
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		case errors.Is(err, usecase.ErrAccountNotActive):
			c.JSON(http.StatusForbidden, gin.H{"error": "actor account is not active"})
		case errors.Is(err, usecase.ErrInvalidEventType):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event type"})
		case errors.Is(err, repository.ErrAccountNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change account status"})
		}
		return
	}

	c.JSON(http.StatusOK, log)
}

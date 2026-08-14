package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hiro-nono/team_z/backend/internal/model"
)

var (
	// ErrPermissionDenied はAdmin権限が必要な操作をAdmin以外が実行しようとした場合のエラー
	ErrPermissionDenied = errors.New("permission denied")
	// ErrAccountNotActive はアカウントの現在ステータスがActiveでない場合のエラー
	ErrAccountNotActive = errors.New("account is not active")
	// ErrInvalidEventType はChangeAccountStatusで扱えないイベント種別が指定された場合のエラー
	ErrInvalidEventType = errors.New("invalid event type")
)

// AccountRepository はaccountUsecaseがAccountの永続化に必要とする操作
type AccountRepository interface {
	Create(ctx context.Context, account *model.Account) error
	FindByID(ctx context.Context, id uuid.UUID) (*model.Account, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status model.AccountStatus) error
	UpdateWithdrawScheduledAt(ctx context.Context, id uuid.UUID, scheduledAt *time.Time) error
}

// AccountStatusLogRepository はaccountUsecaseがステータス変更履歴の記録に必要とする操作
type AccountStatusLogRepository interface {
	Create(ctx context.Context, log *model.AccountStatusLog) error
}

// TransactionManager はaccountUsecaseが複数の永続化操作をまとめて実行するために必要とする操作
type TransactionManager interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}

// AccountUsecase はAccountに関するユースケースを扱う
type AccountUsecase struct {
	accountRepository          AccountRepository
	accountStatusLogRepository AccountStatusLogRepository
	transactionManager         TransactionManager
}

func NewAccountUsecase(
	accountRepository AccountRepository,
	accountStatusLogRepository AccountStatusLogRepository,
	transactionManager TransactionManager,
) *AccountUsecase {
	return &AccountUsecase{
		accountRepository:          accountRepository,
		accountStatusLogRepository: accountStatusLogRepository,
		transactionManager:         transactionManager,
	}
}

func (u *AccountUsecase) CreateAccount(ctx context.Context, authID uuid.UUID) (*model.Account, error) {
	account := &model.Account{
		ID:            uuid.New(),
		AuthID:        authID,
		Role:          model.AccountRoleGuardian,
		AccountStatus: model.AccountStatusActive,
	}

	if err := u.accountRepository.Create(ctx, account); err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	return account, nil
}

func (u *AccountUsecase) GetAccount(ctx context.Context, id uuid.UUID) (*model.Account, error) {
	return u.accountRepository.FindByID(ctx, id)
}

// WithdrawAccount はAccountを退会状態にし、退会から1か月後をデータ削除予定日時として設定する
// 実際のデータ削除は削除予定日時経過後に定期実行Job(AccountDeletionUsecase)が行う
func (u *AccountUsecase) WithdrawAccount(ctx context.Context, id uuid.UUID) error {
	account, err := u.accountRepository.FindByID(ctx, id)
	if err != nil {
		return err
	}

	scheduledAt := time.Now().AddDate(0, 1, 0)

	return u.transactionManager.Do(ctx, func(ctx context.Context) error {
		if err := u.accountRepository.UpdateStatus(ctx, id, model.AccountStatusWithdrawn); err != nil {
			return err
		}
		if err := u.accountRepository.UpdateWithdrawScheduledAt(ctx, id, &scheduledAt); err != nil {
			return err
		}
		return u.accountStatusLogRepository.Create(ctx, &model.AccountStatusLog{
			ID:         uuid.New(),
			AccountID:  id,
			EventType:  model.AccountEventWithdrawn,
			FromStatus: account.AccountStatus,
			ToStatus:   model.AccountStatusWithdrawn,
		})
	})
}

func (u *AccountUsecase) ChangeAccountStatus(ctx context.Context, accountID uuid.UUID, actorAccountID uuid.UUID, eventType model.AccountEventType) (*model.AccountStatusLog, error) {
	toStatus, err := statusForEvent(eventType)
	if err != nil {
		return nil, err
	}

	actor, err := u.accountRepository.FindByID(ctx, actorAccountID)
	if err != nil {
		return nil, err
	}
	if actor.Role != model.AccountRoleAdmin {
		return nil, ErrPermissionDenied
	}
	if actor.AccountStatus != model.AccountStatusActive {
		return nil, ErrAccountNotActive
	}

	account, err := u.accountRepository.FindByID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	log := &model.AccountStatusLog{
		ID:         uuid.New(),
		AccountID:  accountID,
		EventType:  eventType,
		FromStatus: account.AccountStatus,
		ToStatus:   toStatus,
	}

	err = u.transactionManager.Do(ctx, func(ctx context.Context) error {
		if err := u.accountRepository.UpdateStatus(ctx, accountID, toStatus); err != nil {
			return err
		}
		return u.accountStatusLogRepository.Create(ctx, log)
	})
	if err != nil {
		return nil, err
	}

	return log, nil
}

func (u *AccountUsecase) EnsureActive(ctx context.Context, accountID uuid.UUID) error {
	account, err := u.accountRepository.FindByID(ctx, accountID)
	if err != nil {
		return err
	}
	if account.AccountStatus != model.AccountStatusActive {
		return ErrAccountNotActive
	}
	return nil
}

// statusForEvent はAdmin操作によるステータスイベントを遷移後のステータスへ変換する
// 退会(WITHDRAWN)はWithdrawAccountでのみ扱うためここでは扱わない
func statusForEvent(eventType model.AccountEventType) (model.AccountStatus, error) {
	switch eventType {
	case model.AccountEventSuspended:
		return model.AccountStatusSuspended, nil
	case model.AccountEventReactivated:
		return model.AccountStatusActive, nil
	case model.AccountEventFrozen:
		return model.AccountStatusFrozen, nil
	case model.AccountEventUnfrozen:
		return model.AccountStatusActive, nil
	case model.AccountEventBanned:
		return model.AccountStatusBanned, nil
	default:
		return "", fmt.Errorf("%w: %s", ErrInvalidEventType, eventType)
	}
}

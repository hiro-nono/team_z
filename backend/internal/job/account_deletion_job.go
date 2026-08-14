package job

import (
	"context"
	"log"
	"time"
)

// AccountDeletionUsecase はAccountDeletionJobが削除対象Accountの検出・削除に必要とするユースケース。
// Job自身はRepositoryや外部APIを直接操作せず、必ずこのUsecaseを経由する。
type AccountDeletionUsecase interface {
	DeleteScheduledAccounts(ctx context.Context) error
}

// AccountDeletionJob は退会後1か月を経過したAccountのデータ削除を定期的に実行するJob
type AccountDeletionJob struct {
	accountDeletionUsecase AccountDeletionUsecase
	interval               time.Duration
}

func NewAccountDeletionJob(accountDeletionUsecase AccountDeletionUsecase, interval time.Duration) *AccountDeletionJob {
	return &AccountDeletionJob{
		accountDeletionUsecase: accountDeletionUsecase,
		interval:               interval,
	}
}

// Start はJobをintervalごとに実行し続ける。ctxがキャンセルされると停止する。
// 呼び出し側はgoroutineとして起動すること。
func (j *AccountDeletionJob) Start(ctx context.Context) {
	j.run(ctx)

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			j.run(ctx)
		}
	}
}

func (j *AccountDeletionJob) run(ctx context.Context) {
	if err := j.accountDeletionUsecase.DeleteScheduledAccounts(ctx); err != nil {
		log.Printf("account deletion job failed: %v", err)
	}
}

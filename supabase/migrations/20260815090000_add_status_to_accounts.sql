ALTER TABLE public.accounts
    ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN withdraw_scheduled_at TIMESTAMPTZ;

CREATE INDEX idx_accounts_withdraw_scheduled_at
    ON public.accounts(withdraw_scheduled_at);

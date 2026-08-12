CREATE TABLE public.account_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id UUID NOT NULL,

    event_type VARCHAR(20) NOT NULL,

    status VARCHAR(20) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_account_status_logs_account
        FOREIGN KEY (account_id)
        REFERENCES public.accounts(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_account_status_logs_account_id
    ON public.account_status_logs(account_id);
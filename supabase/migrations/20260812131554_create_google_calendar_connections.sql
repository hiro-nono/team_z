CREATE TABLE public.google_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id UUID NOT NULL,

    provider VARCHAR(50) NOT NULL,

    provider_id VARCHAR(255) NOT NULL,

    access_token TEXT NOT NULL,

    refresh_token TEXT,

    scope TEXT,

    expired_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_oauth_account
        FOREIGN KEY (account_id)
        REFERENCES public.accounts(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_google_calendar_connections_account_id
    ON public.google_calendar_connections(account_id);
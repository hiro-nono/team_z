CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    auth_id UUID NOT NULL UNIQUE,

    role VARCHAR(20) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_accounts_auth_user
        FOREIGN KEY (auth_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);
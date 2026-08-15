DROP INDEX IF EXISTS idx_google_calendar_connections_account_id;

ALTER TABLE public.google_calendar_connections
    ADD CONSTRAINT uq_google_calendar_connections_account_id UNIQUE (account_id);

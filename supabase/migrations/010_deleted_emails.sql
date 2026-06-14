-- Phase 4: Per-email deletion log (enables run history detail + undo)
CREATE TABLE IF NOT EXISTS deleted_emails (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID        NOT NULL REFERENCES cleaning_runs(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_id  UUID        NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    email_id    TEXT        NOT NULL,   -- Gmail message ID, used for untrash/restore
    subject     TEXT,
    sender      TEXT,
    category    TEXT,                   -- SPAM | MARKETING | SOCIAL | OLD_READ
    confidence  TEXT,                   -- high | medium | low
    reasoning   TEXT,
    action      TEXT        NOT NULL DEFAULT 'trashed'
                                CHECK (action IN ('trashed', 'archived')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deleted_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own deleted emails"
    ON deleted_emails FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deleted_emails_run_id
    ON deleted_emails (run_id);

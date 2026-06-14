-- Phase 2: Inbox Storage Analyzer results table
CREATE TABLE IF NOT EXISTS inbox_analyses (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_id            UUID        NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    status                TEXT        NOT NULL DEFAULT 'running'
                                        CHECK (status IN ('running', 'completed', 'failed')),
    total_emails          INT         NOT NULL DEFAULT 0,
    total_size_bytes      BIGINT      NOT NULL DEFAULT 0,
    recoverable_size_bytes BIGINT     NOT NULL DEFAULT 0,
    breakdown             JSONB       NOT NULL DEFAULT '{}',
    top_senders           JSONB       NOT NULL DEFAULT '[]',
    error_message         TEXT,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE inbox_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own analyses"
    ON inbox_analyses
    FOR ALL
    USING (auth.uid() = user_id);

-- Index for latest-analysis lookups
CREATE INDEX IF NOT EXISTS idx_inbox_analyses_account_created
    ON inbox_analyses (account_id, created_at DESC);

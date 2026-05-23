CREATE TABLE IF NOT EXISTS deleted_emails (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID        NOT NULL REFERENCES cleaning_runs(id) ON DELETE CASCADE,
  subject    TEXT,
  sender     TEXT,
  category   TEXT,
  reasoning  TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deleted_emails_run ON deleted_emails(run_id);

ALTER TABLE deleted_emails ENABLE ROW LEVEL SECURITY;
-- Users can only see deleted emails from their own runs
CREATE POLICY "Users view own deleted emails" ON deleted_emails
  FOR SELECT USING (
    run_id IN (SELECT id FROM cleaning_runs WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS cleaning_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id      UUID        NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  emails_fetched  INT         NOT NULL DEFAULT 0,
  emails_deleted  INT         NOT NULL DEFAULT 0,
  emails_kept     INT         NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  error_message   TEXT
);

CREATE INDEX idx_cleaning_runs_user    ON cleaning_runs(user_id);
CREATE INDEX idx_cleaning_runs_account ON cleaning_runs(account_id);

ALTER TABLE cleaning_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own runs" ON cleaning_runs
  USING (auth.uid() = user_id);

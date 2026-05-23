CREATE TABLE IF NOT EXISTS email_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL DEFAULT 'imap',
  email           TEXT        NOT NULL,
  encrypted_token TEXT        NOT NULL,
  imap_host       TEXT,
  imap_port       INT         DEFAULT 993,
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON email_accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

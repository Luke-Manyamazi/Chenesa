-- Migration 010: Extend deleted_emails for Phase 4 (table exists from 004)
-- Adds: user_id, account_id, email_id, confidence, action columns

-- 1. Add new columns (nullable first so existing rows don't violate NOT NULL)
ALTER TABLE deleted_emails
  ADD COLUMN IF NOT EXISTS user_id    UUID,
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS email_id   TEXT,
  ADD COLUMN IF NOT EXISTS confidence TEXT,
  ADD COLUMN IF NOT EXISTS action     TEXT NOT NULL DEFAULT 'trashed';

-- 2. Backfill user_id + account_id from cleaning_runs for any existing rows
UPDATE deleted_emails de
SET
  user_id    = cr.user_id,
  account_id = cr.account_id
FROM cleaning_runs cr
WHERE de.run_id = cr.id
  AND de.user_id IS NULL;

-- 3. Now enforce NOT NULL (safe after backfill)
ALTER TABLE deleted_emails
  ALTER COLUMN user_id    SET NOT NULL,
  ALTER COLUMN account_id SET NOT NULL;

-- 4. Add action CHECK constraint (wrapped to skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deleted_emails_action_check'
      AND conrelid = 'deleted_emails'::regclass
  ) THEN
    ALTER TABLE deleted_emails
      ADD CONSTRAINT deleted_emails_action_check
        CHECK (action IN ('trashed', 'archived'));
  END IF;
END
$$;

-- 5. Extra index for account-level lookups
CREATE INDEX IF NOT EXISTS idx_deleted_emails_account
  ON deleted_emails (account_id);

-- 6. Replace old policy (subquery-based) with direct user_id column check
DROP POLICY IF EXISTS "Users view own deleted emails" ON deleted_emails;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deleted_emails'
      AND policyname = 'Users can access own deleted emails'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can access own deleted emails"
      ON deleted_emails FOR ALL
      USING (auth.uid() = user_id)';
  END IF;
END
$$;

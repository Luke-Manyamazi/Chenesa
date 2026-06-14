-- Add cleanup_mode to cleaning_runs for tracking and reporting.
-- Existing rows default to 'aggressive' (previous behaviour).
ALTER TABLE cleaning_runs
  ADD COLUMN IF NOT EXISTS cleanup_mode TEXT NOT NULL DEFAULT 'aggressive'
    CHECK (cleanup_mode IN ('safe', 'aggressive', 'smart'));

-- Migration 012: PayFast billing fields on profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payfast_token      TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end   TIMESTAMPTZ;

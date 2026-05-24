-- Add old_read_days preference to profiles
-- Allows each user to control how aggressively OLD_READ pre-classification works.
-- Default 180 days = 6 months (conservative — avoids nuking important old emails).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS old_read_days INTEGER NOT NULL DEFAULT 180;

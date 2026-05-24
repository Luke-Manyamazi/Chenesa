-- ─── Migration 007: Waitlist table + reduce free run limit to 1 ─────────────

-- 1. Waitlist table — stores tester email + notification email
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  source     text        DEFAULT 'accounts_page',
  created_at timestamptz DEFAULT now()
);

-- Unique on email so duplicate submissions are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_idx ON public.waitlist (email);

-- Allow authenticated users to insert their own record (no RLS needed for inserts,
-- but add a policy so the service-role key can read all for admin dashboards)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert their own waitlist entry" ON public.waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can read their own waitlist entry" ON public.waitlist
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Change the default free_runs_limit from 3 → 1 for all new sign-ups
ALTER TABLE public.profiles
  ALTER COLUMN free_runs_limit SET DEFAULT 1;

-- 3. Set every FREE user to 1 run — testing phase, everyone gets one try
--    Pro/paid users are NOT touched (subscription_plan != 'free')
UPDATE public.profiles
  SET free_runs_limit = 1
  WHERE free_runs_limit != 1
    AND subscription_plan = 'free';

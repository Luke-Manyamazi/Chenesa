-- Keep Rules: user-defined keywords that always protect emails from deletion
-- An email matching any of the user's rules is force-kept before AI classification.

CREATE TABLE IF NOT EXISTS public.keep_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword     TEXT        NOT NULL,
  match_field TEXT        NOT NULL DEFAULT 'all'
                          CHECK (match_field IN ('subject', 'sender', 'all')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, keyword, match_field)
);

ALTER TABLE public.keep_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own keep_rules"
  ON public.keep_rules FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX keep_rules_user_idx ON public.keep_rules (user_id);

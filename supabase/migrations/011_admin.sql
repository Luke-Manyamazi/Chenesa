-- Migration 011: Admin support + fix subscription_plan enum

-- 1. Add is_admin flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Allow 'business' plan (was missing from original CHECK constraint)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_plan_check
    CHECK (subscription_plan IN ('free', 'basic', 'pro', 'business'));

-- 3. Admin RLS — admins can read all profiles (service role already bypasses RLS,
--    but this allows the authenticated admin user to query all rows via the client)
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- 4. Grant the app's admin user (admin@camluk.co.za) admin access
UPDATE profiles
  SET is_admin = TRUE
  WHERE email = 'admin@camluk.co.za';

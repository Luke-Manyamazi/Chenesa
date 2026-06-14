import { createClient } from '@supabase/supabase-js'

// Service-role client — server-side only, bypasses RLS.
// NEVER import this in client components or expose to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

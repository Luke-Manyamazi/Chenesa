import { createClient } from './supabase/client'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

async function authFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }

  return res.json()
}

export const api = {
  getAccounts: ()                              => authFetch('/accounts'),
  deleteAccount: (id: string)                  => authFetch(`/accounts/${id}`, { method: 'DELETE' }),
  toggleAccount: (id: string, enabled: boolean)=> authFetch(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  connectImap: (data: { email: string; app_password: string; imap_host?: string }) =>
    authFetch('/accounts/imap', { method: 'POST', body: JSON.stringify(data) }),
  getGmailUrl: ()                              => authFetch('/auth/gmail/url'),

  triggerRun: (account_id: string, cleanup_mode: string = 'aggressive') =>
    authFetch('/runs', { method: 'POST', body: JSON.stringify({ account_id, cleanup_mode }) }),
  getRuns: ()                                  => authFetch('/runs'),
  getRunDetail: (id: string)                   => authFetch(`/runs/${id}`),

  getKeepRules: ()                             => authFetch('/settings/keep-rules'),
  addKeepRule:  (keyword: string, match_field: string) =>
    authFetch('/settings/keep-rules', { method: 'POST', body: JSON.stringify({ keyword, match_field }) }),
  deleteKeepRule: (id: string)                 => authFetch(`/settings/keep-rules/${id}`, { method: 'DELETE' }),

  getProfilePrefs: ()                          => authFetch('/settings/profile'),
  // Returns { old_read_days, free_runs_used, free_runs_limit }
  updateProfilePrefs: (prefs: { old_read_days: number }) =>
    authFetch('/settings/profile', { method: 'PATCH', body: JSON.stringify(prefs) }),

  joinWaitlist: (email: string) =>
    authFetch('/waitlist', { method: 'POST', body: JSON.stringify({ email }) }),
}

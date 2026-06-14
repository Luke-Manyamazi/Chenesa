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

  triggerAnalysis: (account_id: string) =>
    authFetch('/analysis/trigger', { method: 'POST', body: JSON.stringify({ account_id }) }),
  getLatestAnalysis: (account_id: string) =>
    authFetch(`/analysis/latest?account_id=${encodeURIComponent(account_id)}`),

  undoRun: (run_id: string) =>
    authFetch(`/runs/${run_id}/undo`, { method: 'POST' }),

  // Billing
  checkoutBilling: (plan: string) =>
    authFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  getSubscription: () => authFetch('/billing/subscription'),
  cancelSubscription: () => authFetch('/billing/cancel', { method: 'POST' }),

  // Admin
  adminOverview: ()                             => authFetch('/admin/overview'),
  adminUsers:    ()                             => authFetch('/admin/users'),
  adminSetPlan:  (user_id: string, plan: string) =>
    authFetch(`/admin/users/${user_id}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
  adminWaitlist: ()                             => authFetch('/admin/waitlist'),
  adminRuns:     ()                             => authFetch('/admin/runs'),
}

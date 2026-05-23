import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { getProviderIcon } from '@/lib/constants'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('free_runs_used, free_runs_limit, subscription_plan')
    .eq('id', user!.id)
    .single()

  // Fetch accounts
  const { data: accounts } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('user_id', user!.id)
    .eq('enabled', true)

  // Fetch recent runs
  const { data: runs } = await supabase
    .from('cleaning_runs')
    .select('*, email_accounts(email)')
    .eq('user_id', user!.id)
    .order('started_at', { ascending: false })
    .limit(5)

  const plan = profile?.subscription_plan ?? 'free'
  const runsUsed = profile?.free_runs_used ?? 0
  const runsLimit = profile?.free_runs_limit ?? 3

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400">Welcome back — here&apos;s your inbox status.</p>
      </div>

      {/* Free trial banner */}
      {plan === 'free' && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-amber-300">
              Free trial — {runsUsed} of {runsLimit} cleans used
            </p>
            <Link href="/settings" className="text-xs text-amber-400 hover:text-amber-300 underline">
              Upgrade
            </Link>
          </div>
          <div className="h-2 rounded-full bg-amber-900/50">
            <div
              className="h-2 rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min((runsUsed / runsLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Connected accounts</h2>
          <Link href="/accounts" className="text-sm text-primary-400 hover:text-primary-300">Manage →</Link>
        </div>
        {!accounts?.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-slate-400 mb-4">No accounts connected yet.</p>
            <Link href="/accounts" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors">
              Connect your first account
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((acc: any) => (
              <div key={acc.id} className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
                <span className="text-2xl">{getProviderIcon(acc.email)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{acc.email}</p>
                  <p className="text-xs text-slate-500 capitalize">{acc.type}</p>
                </div>
                <Link href="/accounts" className="text-xs text-primary-400 hover:text-primary-300">Run →</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      {runs && runs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent cleans</h2>
            <Link href="/history" className="text-sm text-primary-400 hover:text-primary-300">Full history →</Link>
          </div>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Deleted</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run: any) => (
                  <tr key={run.id} className="hover:bg-background/50">
                    <td className="px-4 py-3 text-slate-300 truncate max-w-[140px]">{run.email_accounts?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(run.started_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{run.emails_deleted ?? 0}</td>
                    <td className="px-4 py-3 text-right"><Badge label={run.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

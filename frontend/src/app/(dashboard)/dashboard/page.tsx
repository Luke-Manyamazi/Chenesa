import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Trash2, Play, Mail, Clock, TrendingUp,
  ArrowRight, CheckCircle, AlertCircle, Loader2,
  Zap, BarChart3,
} from 'lucide-react'
import { getProviderIcon } from '@/lib/constants'

function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub: string
  color: 'red' | 'purple' | 'blue' | 'green'
  icon: React.ElementType
}) {
  const palette = {
    red:    'border-red-500/20    bg-gradient-to-br from-red-950/50    to-slate-900 text-red-400',
    purple: 'border-primary-500/20 bg-gradient-to-br from-primary-950/50 to-slate-900 text-primary-400',
    blue:   'border-blue-500/20   bg-gradient-to-br from-blue-950/50   to-slate-900 text-blue-400',
    green:  'border-green-500/20  bg-gradient-to-br from-green-950/50  to-slate-900 text-green-400',
  }
  const cls = palette[color]
  return (
    <div className={`rounded-2xl border p-5 ${cls.split(' ').slice(0,2).join(' ')} ${cls.split(' ').slice(2,6).join(' ')}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${cls.split(' ').at(-1)}`}>{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-current/10`}>
          <Icon size={15} className={cls.split(' ').at(-1)} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, accountsRes, runsRes] = await Promise.all([
    supabase.from('profiles')
      .select('free_runs_used, free_runs_limit, subscription_plan')
      .eq('id', user!.id).single(),
    supabase.from('email_accounts')
      .select('id, email, type, enabled')
      .eq('user_id', user!.id).eq('enabled', true),
    supabase.from('cleaning_runs')
      .select('*, email_accounts(email)')
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(10),
  ])

  const profile  = profileRes.data
  const accounts = accountsRes.data ?? []
  const runs     = runsRes.data ?? []

  const plan       = profile?.subscription_plan ?? 'free'
  const runsUsed   = profile?.free_runs_used ?? 0
  const runsLimit  = profile?.free_runs_limit ?? 3

  const completedRuns  = runs.filter((r: any) => r.status === 'completed')
  const totalDeleted   = completedRuns.reduce((s: number, r: any) => s + (r.emails_deleted ?? 0), 0)
  const totalRuns      = completedRuns.length
  const timeSavedMins  = Math.round(totalDeleted * 10 / 60)
  const timeSavedLabel = timeSavedMins >= 60
    ? `${Math.round(timeSavedMins / 60)}h`
    : `${timeSavedMins}m`

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-5xl space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{greeting} 👋</h1>
          <p className="text-slate-400 mt-1.5">
            {totalDeleted > 0
              ? `Your inbox is ${totalDeleted.toLocaleString()} emails lighter.`
              : 'Connect an account and run your first clean.'}
          </p>
        </div>
        <Link href="/accounts"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold
            hover:opacity-90 transition-opacity shadow-lg shadow-primary-900/40 flex-shrink-0">
          <Zap size={14} className="fill-white" />
          Run clean
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Deleted"   value={totalDeleted.toLocaleString()} sub="emails removed"    color="red"    icon={Trash2}     />
        <StatCard label="Runs"      value={String(totalRuns)}             sub="completed"          color="purple" icon={BarChart3}  />
        <StatCard label="Accounts"  value={String(accounts.length)}       sub="connected"          color="blue"   icon={Mail}       />
        <StatCard label="Saved"     value={timeSavedLabel}                sub="estimated time"     color="green"  icon={Clock}      />
      </div>

      {/* ── Free trial banner ── */}
      {plan === 'free' && (
        <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-r from-amber-950/30 to-slate-900/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-amber-300">Free trial</p>
              <p className="text-xs text-amber-500/70 mt-0.5">
                {runsUsed} of {runsLimit} free cleans used
              </p>
            </div>
            <Link href="/settings"
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors">
              Upgrade →
            </Link>
          </div>
          <div className="h-1.5 rounded-full bg-amber-900/50">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
              style={{ width: `${Math.min((runsUsed / runsLimit) * 100, 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── Recent activity ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent activity</h2>
          <Link href="/history"
            className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors">
            Full history <ArrowRight size={14} />
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-300 font-semibold mb-1">No cleaning runs yet</p>
            <p className="text-slate-500 text-sm mb-5">Connect an account and run your first clean to get started</p>
            <Link href="/accounts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors">
              <Play size={14} /> Get started
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_80px_80px_90px] text-[10px] font-bold uppercase tracking-widest text-slate-600 px-5 py-3 border-b border-border bg-slate-900/40">
              <span>Account</span>
              <span className="text-center">Date</span>
              <span className="text-right">Deleted</span>
              <span className="text-right">Kept</span>
              <span className="text-right">Status</span>
            </div>
            {runs.map((run: any) => (
              <div key={run.id}
                className="grid grid-cols-[1fr_100px_80px_80px_90px] items-center px-5 py-3.5 border-b border-border/40 last:border-0 hover:bg-slate-800/25 transition-colors text-sm">
                <span className="text-slate-200 truncate font-medium">
                  {run.email_accounts?.email ?? '—'}
                </span>
                <span className="text-center text-slate-500 text-xs">
                  {new Date(run.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-right font-bold text-red-400 tabular-nums">
                  {(run.emails_deleted ?? 0).toLocaleString()}
                </span>
                <span className="text-right text-slate-400 tabular-nums">
                  {(run.emails_kept ?? 0).toLocaleString()}
                </span>
                <span className="text-right">
                  {run.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                      <CheckCircle size={11} /> Done
                    </span>
                  ) : run.status === 'running' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary-400 font-medium">
                      <Loader2 size={11} className="animate-spin" /> Running
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
                      <AlertCircle size={11} /> Failed
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Accounts quick view ── */}
      {accounts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Connected accounts</h2>
            <Link href="/accounts"
              className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors">
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((acc: any) => (
              <div key={acc.id}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4
                  hover:border-primary-500/40 hover:bg-slate-800/40 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-2xl flex-shrink-0">
                  {getProviderIcon(acc.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate text-sm">{acc.email}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{acc.type} · active</p>
                </div>
                <Link href="/accounts"
                  className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-primary-400 transition-colors">
                  Run <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

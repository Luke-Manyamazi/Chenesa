import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Trash2, Play, Mail, Clock,
  ArrowRight, CheckCircle, AlertCircle, Loader2,
  BarChart3, Shield, Zap, HardDrive,
} from 'lucide-react'
import { getProviderIcon } from '@/lib/constants'

function StatCard({ label, value, sub, color, icon: Icon, href }: {
  label: string; value: string; sub: string
  color: 'red' | 'purple' | 'blue' | 'green'
  icon: React.ElementType
  href: string
}) {
  const ring = {
    red:    'border-red-500/20    from-red-950/50    text-red-400',
    purple: 'border-primary-500/20 from-primary-950/50 text-primary-400',
    blue:   'border-blue-500/20   from-blue-950/50   text-blue-400',
    green:  'border-green-500/20  from-green-950/50  text-green-400',
  }[color]
  const [border, from, accent] = ring.split(' ')
  return (
    <Link href={href}
      className={`rounded-2xl border ${border} bg-gradient-to-br ${from} to-slate-900/50 p-5
        hover:brightness-110 hover:scale-[1.02] transition-all duration-150 block group`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>{label}</span>
        <Icon size={15} className={`${accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </Link>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, accountsRes, runsRes, analysisRes] = await Promise.all([
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
      .limit(20),
    supabase.from('inbox_analyses')
      .select('total_size_bytes, recoverable_size_bytes, completed_at')
      .eq('user_id', user!.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1),
  ])

  const profile    = profileRes.data
  const accounts   = accountsRes.data ?? []
  const runs       = runsRes.data ?? []
  const latestAnalysis = (analysisRes.data ?? [])[0] ?? null

  const plan      = profile?.subscription_plan ?? 'free'
  const runsUsed  = profile?.free_runs_used ?? 0
  const runsLimit = profile?.free_runs_limit ?? 3

  const completedRuns = runs.filter((r: any) => r.status === 'completed')
  const totalDeleted  = completedRuns.reduce((s: number, r: any) => s + (r.emails_deleted ?? 0), 0)
  const totalRuns     = completedRuns.length
  const timeSavedMins = Math.round(totalDeleted * 10 / 60)
  const timeSaved     = timeSavedMins >= 60 ? `${Math.round(timeSavedMins / 60)}h` : `${timeSavedMins}m`

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const planColors: Record<string, string> = {
    free:     'bg-slate-700/60 text-slate-300',
    basic:    'bg-blue-500/15 text-blue-400',
    pro:      'bg-primary-500/15 text-primary-300',
    business: 'bg-amber-500/15 text-amber-400',
  }
  const planLabel: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro', business: 'Business' }

  return (
    <div className="w-full space-y-6">

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
          <Zap size={14} className="fill-white" /> Run clean
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Deleted"  value={totalDeleted.toLocaleString()} sub="emails removed"  color="red"    icon={Trash2}    href="/history"  />
        <StatCard label="Runs"     value={String(totalRuns)}             sub="completed"        color="purple" icon={BarChart3} href="/history"  />
        <StatCard label="Accounts" value={String(accounts.length)}       sub="connected"        color="blue"   icon={Mail}      href="/accounts" />
        <StatCard label="Saved"    value={timeSaved}                     sub="estimated time"   color="green"  icon={Clock}     href="/history"  />
      </div>

      {/* ── Free trial banner ── */}
      {plan === 'free' && (
        <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-r from-amber-950/30 to-slate-900/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-amber-300">Free trial</p>
              <p className="text-xs text-amber-500/70 mt-0.5">{runsUsed} of {runsLimit} free cleans used</p>
            </div>
            <Link href="/upgrade"
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

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* LEFT — Recent activity (takes 2/3) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent activity</h2>
            <Link href="/history"
              className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors">
              Full history <ArrowRight size={13} />
            </Link>
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
              <Trash2 size={28} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold mb-1">No cleaning runs yet</p>
              <p className="text-slate-500 text-sm mb-4">Connect an account and run your first clean</p>
              <Link href="/accounts"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors">
                <Play size={13} /> Get started
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_90px_70px_70px_80px] text-[10px] font-bold uppercase tracking-widest text-slate-600 px-5 py-3 border-b border-border bg-slate-900/40">
                <span>Account</span>
                <span className="text-center">Date</span>
                <span className="text-right">Deleted</span>
                <span className="text-right">Kept</span>
                <span className="text-right">Status</span>
              </div>
              {runs.map((run: any) => (
                <div key={run.id}
                  className="flex sm:grid sm:grid-cols-[1fr_90px_70px_70px_80px] items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/40 last:border-0 hover:bg-slate-800/25 transition-colors text-sm">
                  <span className="text-slate-200 truncate font-medium flex-1">{run.email_accounts?.email ?? '—'}</span>
                  <span className="hidden sm:block text-center text-slate-500 text-xs">
                    {new Date(run.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="font-bold text-red-400 tabular-nums sm:text-right text-xs">{(run.emails_deleted ?? 0).toLocaleString()} <span className="sm:hidden text-slate-600">del</span></span>
                  <span className="hidden sm:block text-right text-slate-400 tabular-nums">{(run.emails_kept ?? 0).toLocaleString()}</span>
                  <span className="sm:text-right flex-shrink-0">
                    {run.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium"><CheckCircle size={11} /> Done</span>
                    ) : run.status === 'running' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-400 font-medium"><Loader2 size={11} className="animate-spin" /> Running</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium"><AlertCircle size={11} /> Failed</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Info panel (1/3) */}
        <div className="space-y-4">

          {/* Plan card */}
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap size={14} className="text-primary-400" /> Your plan
            </h3>
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${planColors[plan]}`}>
                {planLabel[plan] ?? plan}
              </span>
              {plan === 'free' && (
                <Link href="/upgrade" className="text-xs text-primary-400 hover:text-primary-300">Upgrade →</Link>
              )}
            </div>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Emails per run</span>
                <span className="text-white font-medium">
                  {plan === 'business' ? 'Unlimited' : plan === 'pro' ? '2,000' : plan === 'basic' ? '500' : '100'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Accounts</span>
                <span className="text-white font-medium">
                  {plan === 'business' ? 'Unlimited' : plan === 'pro' ? '5' : plan === 'basic' ? '2' : '1'}
                </span>
              </div>
              {plan === 'free' && (
                <div className="flex justify-between">
                  <span>Free runs left</span>
                  <span className="text-amber-400 font-medium">{Math.max(0, runsLimit - runsUsed)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Connected accounts */}
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2"><Mail size={14} className="text-blue-400" /> Accounts</span>
              <Link href="/accounts" className="text-xs text-primary-400 hover:text-primary-300">Manage →</Link>
            </h3>
            {accounts.length === 0 ? (
              <Link href="/accounts"
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500 hover:border-primary-500/40 hover:text-primary-400 transition-colors">
                <Play size={12} /> Connect your first account
              </Link>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc: any) => (
                  <div key={acc.id}
                    className="flex items-center gap-3 rounded-xl bg-slate-800/40 border border-slate-700/40 px-3 py-2.5">
                    <span className="text-lg">{getProviderIcon(acc.email)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{acc.email}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{acc.type}</p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="Active" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storage recovery card */}
          <Link href="/analysis"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary-500/40 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
              <HardDrive size={15} className="text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Storage analyser</p>
              {latestAnalysis ? (
                <p className="text-xs text-slate-500 mt-0.5">
                  {Math.round((latestAnalysis.recoverable_size_bytes / 1024 / 1024) * 10) / 10} MB recoverable
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">Scan your inbox</p>
              )}
            </div>
            <ArrowRight size={14} className="text-slate-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
          </Link>

          {/* Keep rules shortcut */}
          <Link href="/settings"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary-500/40 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <Shield size={15} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Keep rules</p>
              <p className="text-xs text-slate-500 mt-0.5">Protect important emails</p>
            </div>
            <ArrowRight size={14} className="text-slate-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
          </Link>

        </div>
      </div>
    </div>
  )
}

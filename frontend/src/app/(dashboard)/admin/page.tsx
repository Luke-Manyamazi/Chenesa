'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Zap, Trash2, Mail, Clock, RefreshCw,
  CheckCircle, AlertCircle, Loader2, ShieldAlert,
} from 'lucide-react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Overview {
  total_users: number
  total_runs: number
  total_accounts: number
  total_waitlist: number
  total_emails_deleted: number
  total_recoverable_bytes: number
  plan_breakdown: Record<string, number>
}

interface AdminUser {
  id: string
  email: string
  subscription_plan: string
  free_runs_used: number
  free_runs_limit: number
  is_admin: boolean
  created_at: string
  total_runs: number
  last_run_at: string | null
  last_run_status: string | null
}

interface WaitlistEntry {
  email: string
  source: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString() }

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 ** 3)   return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const PLAN_STYLES: Record<string, string> = {
  free:     'bg-slate-700/60 text-slate-300 border-slate-600/40',
  basic:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pro:      'bg-primary-500/10 text-primary-400 border-primary-500/20',
  business: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const PLANS = ['free', 'basic', 'pro', 'business']

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className={`rounded-2xl border p-5 bg-gradient-to-br to-slate-900/50 ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <Icon size={15} className="text-slate-600" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [overview,  setOverview]  = useState<Overview | null>(null)
  const [users,     setUsers]     = useState<AdminUser[]>([])
  const [waitlist,  setWaitlist]  = useState<WaitlistEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null)
  const [tab, setTab]             = useState<'users' | 'waitlist'>('users')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ov, us, wl] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(),
        api.adminWaitlist(),
      ])
      setOverview(ov)
      setUsers(us)
      setWaitlist(wl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePlanChange = async (userId: string, plan: string) => {
    setUpdatingPlan(userId)
    try {
      await api.adminSetPlan(userId, plan)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_plan: plan } : u))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Plan update failed')
    } finally {
      setUpdatingPlan(null)
    }
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-sm text-red-400">{error}</p>
      <button onClick={load} className="text-xs text-primary-400 hover:underline">Retry</button>
    </div>
  )

  return (
    <div className="w-full space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert size={16} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Platform overview — visible to admins only</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-border hover:border-slate-600 transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {loading && !overview ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl border border-border bg-surface animate-pulse" />)}
        </div>
      ) : overview && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Users"    value={fmt(overview.total_users)}          icon={Users}  color="border-blue-500/20 from-blue-950/30" />
            <StatCard label="Total Runs"     value={fmt(overview.total_runs)}           icon={Zap}    color="border-primary-500/20 from-primary-950/30" />
            <StatCard label="Emails Deleted" value={fmt(overview.total_emails_deleted)} icon={Trash2} color="border-red-500/20 from-red-950/30" />
            <StatCard label="Waitlist"       value={fmt(overview.total_waitlist)}       icon={Mail}   color="border-amber-500/20 from-amber-950/30"
              sub={`${fmt(overview.total_accounts)} accounts`} />
          </div>

          {/* Plan breakdown */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Plan breakdown</p>
            <div className="flex flex-wrap gap-3">
              {PLANS.map(plan => (
                <div key={plan} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${PLAN_STYLES[plan] ?? ''}`}>
                  <span className="font-bold capitalize">{plan}</span>
                  <span className="text-lg font-extrabold">{overview.plan_breakdown[plan] ?? 0}</span>
                </div>
              ))}
              {overview.total_recoverable_bytes > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/20 bg-green-500/10 text-sm text-green-400 ml-auto">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total Recoverable</span>
                  <span className="font-bold">{fmtBytes(overview.total_recoverable_bytes)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['users', 'waitlist'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary-500 text-primary-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t} {t === 'users' ? `(${users.length})` : `(${waitlist.length})`}
          </button>
        ))}
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Runs</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Free used</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Last run</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Joined</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Change plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium max-w-[200px] truncate">
                      <div className="flex items-center gap-1.5">
                        {u.email}
                        {u.is_admin && <ShieldAlert size={11} className="text-red-400 flex-shrink-0" title="Admin" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg border ${PLAN_STYLES[u.subscription_plan] ?? ''}`}>
                        {u.subscription_plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300 tabular-nums">{u.total_runs}</td>
                    <td className="px-4 py-3 text-center text-slate-400 tabular-nums text-xs">
                      {u.free_runs_used}/{u.free_runs_limit}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.last_run_at
                        ? new Date(u.last_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                      {u.last_run_status === 'completed' && <CheckCircle size={10} className="inline ml-1 text-green-500" />}
                      {u.last_run_status === 'failed'    && <AlertCircle size={10} className="inline ml-1 text-red-500" />}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={u.subscription_plan}
                          onChange={e => handlePlanChange(u.id, e.target.value)}
                          disabled={updatingPlan === u.id}
                          className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary-500 disabled:opacity-40"
                        >
                          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {updatingPlan === u.id && <Loader2 size={12} className="animate-spin text-primary-400" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && !loading && (
              <p className="text-center text-slate-500 text-sm py-10">No users found</p>
            )}
          </div>
        </div>
      )}

      {/* Waitlist table */}
      {tab === 'waitlist' && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Source</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {waitlist.map((w, i) => (
                  <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{w.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{w.source}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {waitlist.length === 0 && !loading && (
              <div className="text-center py-10">
                <Clock size={24} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No waitlist entries yet</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { HardDrive, RefreshCw, AlertCircle, ChevronRight, Inbox } from 'lucide-react'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Account {
  id: string
  email: string
  type: string
  enabled: boolean
}

interface CategoryBreakdown {
  count: number
  size_bytes: number
}

interface TopSender {
  sender: string
  count: number
  size_bytes: number
}

interface Analysis {
  id: string
  status: 'running' | 'completed' | 'failed' | 'none'
  total_emails: number
  total_size_bytes: number
  recoverable_size_bytes: number
  breakdown: Record<string, CategoryBreakdown>
  top_senders: TopSender[]
  completed_at: string | null
  error_message: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

const CATEGORY_META: Record<string, { label: string; color: string; bar: string }> = {
  marketing:  { label: 'Marketing',   color: 'text-amber-400',  bar: 'bg-amber-500' },
  social:     { label: 'Social',      color: 'text-sky-400',    bar: 'bg-sky-500' },
  spam:       { label: 'Spam',        color: 'text-red-400',    bar: 'bg-red-500' },
  old_read:   { label: 'Old & Read',  color: 'text-purple-400', bar: 'bg-purple-500' },
  other:      { label: 'Other',       color: 'text-slate-400',  bar: 'bg-slate-600' },
}

const RECOVERABLE = new Set(['marketing', 'social', 'spam', 'old_read'])

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-1">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Gmail accounts
  useEffect(() => {
    api.getAccounts()
      .then((data: Account[]) => {
        const gmail = (data ?? []).filter((a: Account) => a.type === 'gmail')
        setAccounts(gmail)
        if (gmail.length > 0) setSelectedId(gmail[0].id)
      })
      .catch(() => setError('Failed to load accounts'))
  }, [])

  // When account changes, load the latest analysis
  const loadLatest = useCallback(async (accountId: string) => {
    if (!accountId) return
    try {
      const data = await api.getLatestAnalysis(accountId)
      setAnalysis(data?.status === 'none' ? null : data)
      // If still running, keep polling
      if (data?.status === 'running') setPolling(true)
    } catch {
      // no prior analysis — that's fine
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      setAnalysis(null)
      setError(null)
      loadLatest(selectedId)
    }
  }, [selectedId, loadLatest])

  // Poll every 3s while status is 'running'
  useEffect(() => {
    if (!polling || !selectedId) return
    const interval = setInterval(async () => {
      const data = await api.getLatestAnalysis(selectedId).catch(() => null)
      if (!data) return
      setAnalysis(data)
      if (data.status !== 'running') {
        setPolling(false)
        setLoading(false)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [polling, selectedId])

  const handleAnalyse = async () => {
    if (!selectedId) return
    setError(null)
    setLoading(true)
    try {
      await api.triggerAnalysis(selectedId)
      setPolling(true)
      // Immediately show a 'running' placeholder
      setAnalysis({
        id: '',
        status: 'running',
        total_emails: 0,
        total_size_bytes: 0,
        recoverable_size_bytes: 0,
        breakdown: {},
        top_senders: [],
        completed_at: null,
        error_message: null,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
      setLoading(false)
    }
  }

  const selectedAccount = accounts.find(a => a.id === selectedId)
  const isRunning = analysis?.status === 'running'
  const isCompleted = analysis?.status === 'completed'

  const totalSize = analysis?.total_size_bytes ?? 0
  const recoverableSize = analysis?.recoverable_size_bytes ?? 0
  const recoverablePct = pct(recoverableSize, totalSize)

  // Breakdown sorted: recoverable first, then other
  const breakdownEntries = isCompleted
    ? Object.entries(analysis!.breakdown).sort(([a], [b]) => {
        const aRec = RECOVERABLE.has(a) ? 0 : 1
        const bRec = RECOVERABLE.has(b) ? 0 : 1
        return aRec - bRec || b[1].size_bytes - a[1].size_bytes
      })
    : []

  if (accounts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Inbox size={48} className="text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">No Gmail accounts connected</h2>
        <p className="text-sm text-slate-500">Connect a Gmail account in Accounts to analyse your storage.</p>
        <a href="/accounts" className="text-sm text-primary-400 hover:underline flex items-center gap-1">
          Go to Accounts <ChevronRight size={14} />
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HardDrive size={20} className="text-primary-400" />
            <h1 className="text-xl font-bold text-white">Storage Analyser</h1>
          </div>
          <p className="text-sm text-slate-400">
            Scan your Gmail to see exactly what's eating your storage and how much you can recover.
          </p>
        </div>

        {/* Account selector + Run button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {accounts.length > 1 && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="text-sm bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.email}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleAnalyse}
            disabled={loading || isRunning || !selectedId}
            className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
            {isRunning ? 'Analysing…' : 'Analyse Inbox'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ── Running state ── */}
      {isRunning && (
        <div className="rounded-2xl border border-primary-800/30 bg-primary-950/20 px-6 py-8 text-center space-y-3">
          <RefreshCw size={32} className="text-primary-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-primary-300">Scanning up to 1,000 emails…</p>
          <p className="text-xs text-slate-500">This usually takes 30–60 seconds. This page will update automatically.</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!analysis && !isRunning && !error && (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center space-y-3">
          <HardDrive size={40} className="text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-400">No analysis yet</p>
          <p className="text-xs text-slate-600">
            Click "Analyse Inbox" to scan {selectedAccount?.email ?? 'your account'} and see your storage breakdown.
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {isCompleted && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Emails Scanned"
              value={analysis!.total_emails.toLocaleString()}
              sub="of up to 1,000"
            />
            <StatCard
              label="Total Size"
              value={formatBytes(totalSize)}
              sub="scanned emails"
            />
            <StatCard
              label="Recoverable"
              value={formatBytes(recoverableSize)}
              sub={`${recoverablePct}% of total`}
            />
            <StatCard
              label="Recovery %"
              value={`${recoverablePct}%`}
              sub="can be freed"
            />
          </div>

          {/* Recovery bar */}
          <div className="rounded-2xl bg-surface border border-border p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white">Storage recovery potential</span>
              <span className="text-primary-400 font-bold">{formatBytes(recoverableSize)} freeable</span>
            </div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700"
                style={{ width: `${recoverablePct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Running a cleanup on this account could recover approximately {formatBytes(recoverableSize)}.
            </p>
          </div>

          {/* Category breakdown */}
          {breakdownEntries.length > 0 && (
            <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Breakdown by category</h2>
              <div className="space-y-3">
                {breakdownEntries.map(([cat, data]) => {
                  const meta = CATEGORY_META[cat] ?? { label: cat, color: 'text-slate-400', bar: 'bg-slate-600' }
                  const catPct = pct(data.size_bytes, totalSize)
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                          {RECOVERABLE.has(cat) && (
                            <span className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded-full">
                              recoverable
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-slate-400">
                          <span>{data.count.toLocaleString()} emails</span>
                          <span className="font-semibold text-slate-300">{formatBytes(data.size_bytes)}</span>
                          <span className="w-8 text-right">{catPct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${meta.bar} transition-all duration-500`}
                          style={{ width: `${catPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top senders */}
          {(analysis!.top_senders ?? []).length > 0 && (
            <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Top senders by storage</h2>
              <div className="space-y-1">
                {analysis!.top_senders.map((s, i) => (
                  <div
                    key={s.sender}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="text-xs text-slate-600 w-5 text-right">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-300 truncate">{s.sender}</span>
                    <span className="text-xs text-slate-500">{s.count.toLocaleString()} emails</span>
                    <span className="text-sm font-semibold text-slate-200 w-20 text-right">{formatBytes(s.size_bytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl border border-primary-800/30 bg-primary-950/15 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary-300">Ready to recover {formatBytes(recoverableSize)}?</p>
              <p className="text-xs text-slate-500 mt-0.5">Run a cleanup on this account to free up storage space.</p>
            </div>
            <a
              href="/accounts"
              className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 transition-colors flex-shrink-0"
            >
              Clean up now <ChevronRight size={14} />
            </a>
          </div>

          {analysis!.completed_at && (
            <p className="text-center text-xs text-slate-700">
              Last analysed {new Date(analysis!.completed_at).toLocaleString()}
            </p>
          )}
        </>
      )}

      {/* Failed state */}
      {analysis?.status === 'failed' && (
        <div className="rounded-2xl border border-red-800/40 bg-red-950/20 px-6 py-8 text-center space-y-2">
          <AlertCircle size={32} className="text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-red-300">Analysis failed</p>
          <p className="text-xs text-slate-500">{analysis.error_message ?? 'Unknown error'}</p>
          <button onClick={handleAnalyse} className="text-xs text-primary-400 hover:underline mt-2">
            Try again
          </button>
        </div>
      )}

    </div>
  )
}

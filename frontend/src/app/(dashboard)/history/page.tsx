'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trash2, CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants'

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
      <CheckCircle size={10} /> Done
    </span>
  )
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
      <Loader2 size={10} className="animate-spin" /> Running
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <AlertCircle size={10} /> Failed
    </span>
  )
}

export default function HistoryPage() {
  const [runs,     setRuns]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details,  setDetails]  = useState<Record<string, any[]>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  useEffect(() => {
    api.getRuns().then(setRuns).finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (runId: string) => {
    if (expanded === runId) { setExpanded(null); return }
    setExpanded(runId)
    if (!details[runId]) {
      setLoadingDetail(runId)
      try {
        const d = await api.getRunDetail(runId)
        setDetails(prev => ({ ...prev, [runId]: d.deleted_emails ?? [] }))
      } finally {
        setLoadingDetail(null)
      }
    }
  }

  const totalDeleted = runs.reduce((s, r) => s + (r.emails_deleted ?? 0), 0)

  return (
    <div className="max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cleaning history</h1>
          <p className="text-slate-400 mt-1">Every email Chenesa has cleaned, with AI reasoning.</p>
        </div>
        {totalDeleted > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 border border-red-500/20">
            <Trash2 size={14} className="text-red-400" />
            <span className="text-sm font-bold text-white">{totalDeleted.toLocaleString()}</span>
            <span className="text-xs text-red-400">total deleted</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-2xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-300 font-semibold mb-1">No cleaning runs yet</p>
          <p className="text-slate-500 text-sm">Go to Accounts to run your first clean.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => (
            <div key={run.id} className="rounded-2xl border border-border bg-surface overflow-hidden hover:border-slate-600/80 transition-colors">
              {/* Run summary row */}
              <button onClick={() => toggleExpand(run.id)}
                className="w-full flex items-center gap-5 px-5 py-4 hover:bg-slate-800/30 transition-colors text-left">
                {/* Account + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {run.email_accounts?.email ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(run.started_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 text-sm flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-red-400 tabular-nums">{(run.emails_deleted ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-600">deleted</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-300 tabular-nums">{(run.emails_kept ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-600">kept</p>
                  </div>
                  <StatusBadge status={run.status} />
                  {expanded === run.id
                    ? <ChevronUp size={15} className="text-slate-500" />
                    : <ChevronDown size={15} className="text-slate-500" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === run.id && (
                <div className="border-t border-border">
                  {loadingDetail === run.id ? (
                    <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-400">
                      <Loader2 size={14} className="animate-spin" /> Loading details…
                    </div>
                  ) : !details[run.id] || details[run.id].length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-500">No detailed email log for this run.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900/50 border-b border-border">
                          <tr>
                            <th className="px-5 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                            <th className="px-5 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Sender</th>
                            <th className="px-5 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="px-5 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {details[run.id].map((e: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-5 py-2.5 text-slate-200 max-w-[200px] truncate font-medium">{e.subject}</td>
                              <td className="px-5 py-2.5 text-slate-400 max-w-[160px] truncate">{e.sender}</td>
                              <td className="px-5 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_COLORS[e.category] ?? 'bg-slate-700 text-slate-300'}`}>
                                  {CATEGORY_LABELS[e.category] ?? e.category}
                                </span>
                              </td>
                              <td className="px-5 py-2.5 text-slate-500 max-w-[220px] truncate">{e.reasoning}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'

export default function HistoryPage() {
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, any[]>>({})

  useEffect(() => {
    api.getRuns().then(setRuns).finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (runId: string) => {
    if (expanded === runId) { setExpanded(null); return }
    setExpanded(runId)
    if (!details[runId]) {
      const d = await api.getRunDetail(runId)
      setDetails(prev => ({ ...prev, [runId]: d.deleted_emails ?? [] }))
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cleaning history</h1>
        <p className="text-slate-400">Every email Chenesa has cleaned, with AI reasoning.</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-slate-400">
          No cleaning runs yet. Go to Accounts to run your first clean.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => (
            <div key={run.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <button onClick={() => toggleExpand(run.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition-colors text-left">
                <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                  <span className="text-slate-300 truncate">{run.email_accounts?.email ?? '—'}</span>
                  <span className="text-slate-400">{new Date(run.started_at).toLocaleDateString()}</span>
                  <span className="text-white font-medium">{run.emails_deleted ?? 0} deleted</span>
                  <Badge label={run.status} />
                </div>
                {expanded === run.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {expanded === run.id && details[run.id] && (
                <div className="border-t border-border">
                  {details[run.id].length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-500">No email details recorded.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-background/50">
                        <tr>
                          <th className="px-5 py-2 text-left text-slate-500">Subject</th>
                          <th className="px-5 py-2 text-left text-slate-500">Sender</th>
                          <th className="px-5 py-2 text-left text-slate-500">Category</th>
                          <th className="px-5 py-2 text-left text-slate-500">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {details[run.id].map((e: any, i: number) => (
                          <tr key={i} className="hover:bg-background/30">
                            <td className="px-5 py-2 text-slate-300 max-w-[200px] truncate">{e.subject}</td>
                            <td className="px-5 py-2 text-slate-400 max-w-[150px] truncate">{e.sender}</td>
                            <td className="px-5 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[e.category]}`}>
                                {CATEGORY_LABELS[e.category] ?? e.category}
                              </span>
                            </td>
                            <td className="px-5 py-2 text-slate-500 max-w-[200px] truncate">{e.reasoning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

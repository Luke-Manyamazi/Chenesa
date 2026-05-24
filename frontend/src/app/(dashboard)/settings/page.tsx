'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, XCircle, BookMarked } from 'lucide-react'
import { api } from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Rule = { id: string; keyword: string; match_field: string; created_at: string }

const FIELD_LABELS: Record<string, string> = {
  all:     'Anywhere',
  subject: 'Subject',
  sender:  'Sender',
}

const FIELD_COLORS: Record<string, string> = {
  all:     'bg-primary-500/10 text-primary-400 border-primary-500/25',
  subject: 'bg-blue-500/10    text-blue-400    border-blue-500/25',
  sender:  'bg-green-500/10   text-green-400   border-green-500/25',
}

const EXAMPLES = [
  { keyword: 'invoice',   match_field: 'subject', label: 'Invoices' },
  { keyword: 'payslip',   match_field: 'subject', label: 'Payslips' },
  { keyword: 'receipt',   match_field: 'subject', label: 'Receipts' },
  { keyword: 'statement', match_field: 'subject', label: 'Statements' },
]

export default function SettingsPage() {
  const [rules,      setRules]      = useState<Rule[]>([])
  const [loading,    setLoading]    = useState(true)
  const [keyword,    setKeyword]    = useState('')
  const [matchField, setMatchField] = useState('all')
  const [adding,     setAdding]     = useState(false)
  const [error,      setError]      = useState('')

  const load = async () => {
    setLoading(true)
    try { setRules(await api.getKeepRules()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const kw = keyword.trim()
    if (!kw) return
    setAdding(true); setError('')
    try {
      await api.addKeepRule(kw, matchField)
      setKeyword(''); await load()
    } catch (err: any) {
      setError(err.message)
    }
    setAdding(false)
  }

  const handleQuickAdd = async (kw: string, field: string) => {
    setError('')
    try { await api.addKeepRule(kw, field); await load() }
    catch (err: any) { setError(err.message) }
  }

  const handleDelete = async (id: string) => {
    try { await api.deleteKeepRule(id); setRules(r => r.filter(x => x.id !== id)) }
    catch (err: any) { setError(err.message) }
  }

  return (
    <div className="w-full max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-1">Control how Chenesa handles your emails.</p>
      </div>

      {/* Keep Rules card */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-slate-900/40">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Shield size={16} className="text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Keep rules</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Emails matching these keywords are <span className="text-green-400 font-medium">always kept</span> — the AI never touches them.
            </p>
          </div>
          {rules.length > 0 && (
            <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
              {rules.length} / 50
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
              <XCircle size={15} /> {error}
            </div>
          )}

          {/* Quick-add suggestions (only shown if not already added) */}
          {(() => {
            const existing = new Set(rules.map(r => `${r.keyword}|${r.match_field}`))
            const suggestions = EXAMPLES.filter(e => !existing.has(`${e.keyword}|${e.match_field}`))
            return suggestions.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick add</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button key={s.keyword} onClick={() => handleQuickAdd(s.keyword, s.match_field)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        border border-slate-700 bg-slate-800/60 text-slate-300
                        hover:border-green-500/40 hover:text-green-300 hover:bg-green-950/20 transition-all">
                      <Plus size={11} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* Add rule form */}
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add custom rule</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  label=""
                  placeholder="e.g. bank statement, noreply@mybank.com…"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </div>
              {/* Match field selector */}
              <div className="sm:flex-shrink-0">
                <select
                  value={matchField}
                  onChange={e => setMatchField(e.target.value)}
                  className="w-full sm:w-auto h-10 mt-0 rounded-xl border border-border bg-slate-800 text-sm text-slate-200 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <option value="all">Anywhere</option>
                  <option value="subject">Subject</option>
                  <option value="sender">Sender</option>
                </select>
              </div>
              <Button type="submit" loading={adding} className="sm:flex-shrink-0 mt-0 w-full sm:w-auto">
                <Plus size={15} /> Add
              </Button>
            </div>
            <p className="text-xs text-slate-600">
              Matching is case-insensitive. "bank" matches "Bank Statement", "my-bank.com", etc.
            </p>
          </form>

          {/* Rules list */}
          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => (
                <div key={i} className="h-12 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <BookMarked size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No keep rules yet.</p>
              <p className="text-slate-600 text-xs mt-1">Add keywords above to protect important emails.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-slate-800/30 hover:bg-slate-800/50 transition-colors group">
                  <Shield size={14} className="text-green-400/60 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-white truncate">
                    {rule.keyword}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${FIELD_COLORS[rule.match_field] ?? FIELD_COLORS.all}`}>
                    {FIELD_LABELS[rule.match_field] ?? rule.match_field}
                  </span>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <BookMarked size={16} className="text-primary-400" /> How keep rules work
        </h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-3"><span className="text-primary-400 font-bold flex-shrink-0">1.</span> Before any AI classification, every email is checked against your rules</li>
          <li className="flex gap-3"><span className="text-primary-400 font-bold flex-shrink-0">2.</span> If a keyword matches (subject, sender, or both) — the email is kept immediately</li>
          <li className="flex gap-3"><span className="text-primary-400 font-bold flex-shrink-0">3.</span> Remaining emails go through the usual AI pipeline</li>
          <li className="flex gap-3"><span className="text-primary-400 font-bold flex-shrink-0">4.</span> Rules override AI — even an old read email with a matching keyword is safe</li>
        </ol>
      </div>

    </div>
  )
}

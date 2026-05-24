'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Play, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { getProviderIcon } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

type Account  = { id: string; email: string; type: string; enabled: boolean; created_at: string }
type RunResult = { status: 'completed' | 'failed'; emails_deleted: number; emails_kept: number; error_message?: string }

// ─── Fake terminal log lines ───────────────────────────────────────────────
const SPAM_LINES = [
  '🗑  "50% OFF — Flash Sale ends TONIGHT!"          → MARKETING',
  '🗑  "You\'ve been selected for a FREE gift card"   → SPAM',
  '🗑  "Weekly digest: top articles for you"          → NEWSLETTER',
  '🗑  "Your friend liked your photo"                 → SOCIAL',
  '🗑  "Exclusive deals just for you this week"       → MARKETING',
  '🗑  "[Newsletter] Industry insights — May 2026"    → NEWSLETTER',
  '🗑  "Confirm your subscription to DailyDeals"      → NEWSLETTER',
  '🗑  "You have unused rewards points expiring soon" → MARKETING',
  '🗑  "Introducing our brand new product line!"      → MARKETING',
  '🗑  "Hot offer: 3 months free, cancel anytime"     → MARKETING',
  '🗑  "Re: Your account needs attention ⚠️"          → SPAM',
  '🗑  "You\'re missing out on these great deals"     → MARKETING',
  '🗑  "Monthly roundup — what you missed"            → NEWSLETTER',
  '🗑  "Someone viewed your profile"                  → SOCIAL',
  '🗑  "Limited time: upgrade for 60% less"           → MARKETING',
  '🗑  "Top picks for you this weekend 🛍️"            → MARKETING',
  '🗑  "Your weekly horoscope is ready"               → NEWSLETTER',
  '🗑  "Alert: your free trial is ending soon"        → MARKETING',
]

const KEEP_LINES = [
  '✅  "Invoice #4821 — April 2026"                   → KEEP',
  '✅  "Re: Meeting tomorrow at 10am"                 → KEEP',
  '✅  "Your order #8873 has been shipped"            → KEEP',
  '✅  "Password reset request"                       → KEEP',
  '✅  "Bank statement available — March"             → KEEP',
]

function buildScript(email: string): { text: string; color: string; delay: number }[] {
  const now = new Date()
  const ts = (offset = 0) => {
    const d = new Date(now.getTime() + offset * 1000)
    return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`
  }

  const emailCount = Math.floor(Math.random() * 800) + 300
  const toAnalyse  = Math.floor(emailCount * 0.4)

  // Shuffle and interleave spam/keep lines
  const shuffled = [...SPAM_LINES, ...KEEP_LINES].sort(() => Math.random() - 0.4).slice(0, 18)

  const phase1: { text: string; color: string; delay: number }[] = [
    { text: '$ Chenesa AI Cleaner v1.0',                                            color: 'text-primary-400', delay: 0 },
    { text: `${ts(0)}  Connecting to IMAP server…`,                                 color: 'text-slate-300',   delay: 400 },
    { text: `${ts(1)}  ✓ Authenticated — ${email}`,                                 color: 'text-green-400',   delay: 1200 },
    { text: `${ts(2)}  Scanning INBOX folder…`,                                     color: 'text-slate-300',   delay: 2000 },
    { text: `${ts(3)}  Found ${emailCount.toLocaleString()} emails`,               color: 'text-yellow-300',  delay: 3000 },
    { text: `${ts(4)}  Filtering by age and read status…`,                          color: 'text-slate-300',   delay: 3800 },
    { text: `${ts(5)}  ${toAnalyse} emails queued for AI analysis`,                color: 'text-yellow-300',  delay: 4600 },
    { text: `${ts(6)}  Starting Claude AI classifier…`,                             color: 'text-slate-300',   delay: 5400 },
    { text: `${ts(7)}  ─────────────────────────────────`,                          color: 'text-slate-600',   delay: 6000 },
  ]

  const phase2 = shuffled.map((line, i) => ({
    text: `${ts(7 + i * 0.8)}  ${line}`,
    color: line.startsWith('🗑') ? 'text-red-400' : 'text-green-400',
    delay: 6400 + i * 800,
  }))

  const phase3 = [
    { text: `${ts(22)}  ─────────────────────────────────`,                         color: 'text-slate-600',   delay: 6400 + 18 * 800 },
    { text: `${ts(23)}  Batch complete. Deleting flagged emails…`,                  color: 'text-slate-300',   delay: 6400 + 18 * 800 + 600 },
    { text: `${ts(24)}  Expunging messages from server…`,                           color: 'text-slate-300',   delay: 6400 + 18 * 800 + 1400 },
    { text: `${ts(25)}  ✓ Done.`,                                                    color: 'text-green-400',   delay: 6400 + 18 * 800 + 2200 },
  ]

  return [...phase1, ...phase2, ...phase3]
}

// ─── Progress + Terminal component ────────────────────────────────────────
const STEPS = ['Connecting to mailbox…','Scanning inbox…','AI is analysing emails…','Removing junk mail…','Almost done…']

function RunProgress({ accountEmail, runId, onDone }: {
  accountEmail: string; runId: string; onDone: (r: RunResult) => void
}) {
  const [stepIdx,   setStepIdx]  = useState(0)
  const [progress,  setProgress] = useState(5)
  const [logs,      setLogs]     = useState<{ text: string; color: string }[]>([])
  const termRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Build and schedule fake log lines
    const script = buildScript(accountEmail)
    script.forEach(({ text, color, delay }) => {
      const t = setTimeout(() => {
        setLogs(prev => [...prev, { text, color }])
        if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
      }, delay)
      timerRef.current.push(t)
    })

    // Progress bar animation
    const barInterval = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, STEPS.length - 1))
      setProgress(p => Math.min(p + 17, 88))
    }, 6000)

    // Poll for real completion
    const pollInterval = setInterval(async () => {
      try {
        const run = await api.getRunDetail(runId)
        if (run.status !== 'running') {
          clearInterval(barInterval)
          clearInterval(pollInterval)
          setProgress(100)
          setTimeout(() => onDone(run), 800)
        }
      } catch {}
    }, 3000)

    return () => {
      timerRef.current.forEach(clearTimeout)
      clearInterval(barInterval)
      clearInterval(pollInterval)
    }
  }, [runId, accountEmail, onDone])

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Top bar */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getProviderIcon(accountEmail)}</span>
          <div>
            <p className="font-medium text-white">{accountEmail}</p>
            <p className="text-xs text-primary-400 animate-pulse">● Cleaning in progress…</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{STEPS[stepIdx]}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-2 rounded-full bg-primary-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="border-t border-border bg-[#0a0e17]">
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <span className="ml-2 text-xs text-slate-500 font-mono">chenesa — cleaner</span>
        </div>
        <div ref={termRef}
          className="h-52 overflow-y-auto px-4 py-3 font-mono text-xs leading-5 space-y-0.5 scroll-smooth">
          {logs.length === 0 && (
            <span className="text-slate-600 animate-pulse">Initialising…</span>
          )}
          {logs.map((l, i) => (
            <div key={i} className={l.color}>{l.text}</div>
          ))}
          {logs.length > 0 && (
            <span className="text-slate-500 animate-pulse">█</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Result card ──────────────────────────────────────────────────────────
function RunResultCard({ accountEmail, result, onDismiss }: {
  accountEmail: string; result: RunResult; onDismiss: () => void
}) {
  const ok = result.status === 'completed'
  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getProviderIcon(accountEmail)}</span>
          <div className="flex-1">
            <p className="font-medium text-white">{accountEmail}</p>
            <p className={`text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
              {ok ? 'Clean complete' : 'Run failed'}
            </p>
          </div>
          {ok ? <CheckCircle size={20} className="text-green-400" /> : <XCircle size={20} className="text-red-400" />}
        </div>
        {ok ? (
          <div className="flex gap-6 pt-1">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{result.emails_deleted}</p>
              <p className="text-xs text-slate-400">deleted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-300">{result.emails_kept}</p>
              <p className="text-xs text-slate-400">kept</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-red-400">{result.error_message ?? 'Unknown error'}</p>
        )}
        <div className="h-1.5 rounded-full">
          <div className={`h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: '100%' }} />
        </div>
        <button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-300">Dismiss</button>
      </div>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeRun,    setActiveRun]    = useState<{ accountId: string; runId: string; email: string } | null>(null)
  const [runResult,    setRunResult]    = useState<{ email: string; result: RunResult } | null>(null)
  const [showImapForm, setShowImapForm] = useState(false)
  const [imapEmail,    setImapEmail]    = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapHost,     setImapHost]     = useState('')
  const [connecting,   setConnecting]   = useState(false)
  const [error,        setError]        = useState('')

  const load = async () => {
    setLoading(true)
    try { setAccounts(await api.getAccounts()) } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRun = async (acc: Account) => {
    setError(''); setRunResult(null)
    try {
      const { run_id } = await api.triggerRun(acc.id)
      setActiveRun({ accountId: acc.id, runId: run_id, email: acc.email })
    } catch (e: any) { setError(e.message) }
  }

  const handleRunDone = (result: RunResult) => {
    const email = activeRun!.email
    setActiveRun(null)
    setRunResult({ email, result })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account?')) return
    await api.deleteAccount(id); load()
  }

  const handleConnectImap = async (e: React.FormEvent) => {
    e.preventDefault(); setConnecting(true); setError('')
    try {
      await api.connectImap({ email: imapEmail, app_password: imapPassword, imap_host: imapHost || undefined })
      setShowImapForm(false); setImapEmail(''); setImapPassword(''); setImapHost(''); load()
    } catch (e: any) { setError(e.message) }
    setConnecting(false)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Email accounts</h1>
        <p className="text-slate-400">Connect any email provider. Chenesa auto-detects the settings.</p>
      </div>

      {error && <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {activeRun && (
        <RunProgress accountEmail={activeRun.email} runId={activeRun.runId} onDone={handleRunDone} />
      )}

      {runResult && (
        <RunResultCard accountEmail={runResult.email} result={runResult.result} onDismiss={() => setRunResult(null)} />
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-slate-400">
          No accounts connected yet. Add one below.
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <Card key={acc.id}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{getProviderIcon(acc.email)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{acc.email}</p>
                  <p className="text-xs text-slate-500 capitalize">{acc.type} account</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={!!activeRun} onClick={() => handleRun(acc)}>
                    <Play size={14} />
                    {activeRun?.accountId === acc.id ? 'Running…' : 'Run now'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(acc.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Connect a new account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={async () => { try { const { url } = await api.getGmailUrl(); window.location.href = url } catch(e: any) { setError(e.message) }}}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary-500 transition-colors text-left">
            <span className="text-2xl">📧</span>
            <div><p className="font-medium text-white">Gmail</p><p className="text-xs text-slate-400">Sign in with Google OAuth</p></div>
          </button>
          <button onClick={() => setShowImapForm(v => !v)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary-500 transition-colors text-left">
            <span className="text-2xl">✉️</span>
            <div><p className="font-medium text-white">Any other provider</p><p className="text-xs text-slate-400">Outlook, Yahoo, iCloud, AOL, Zoho…</p></div>
          </button>
        </div>

        {showImapForm && (
          <form onSubmit={handleConnectImap} className="mt-4 rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="font-semibold text-white">Connect via App Password</h3>
            <Input label="Email address" type="email" placeholder="you@outlook.com" value={imapEmail} onChange={e => setImapEmail(e.target.value)} required />
            <Input label="App Password" type="password" placeholder="xxxx xxxx xxxx xxxx" value={imapPassword} onChange={e => setImapPassword(e.target.value)} required />
            <Input label="IMAP host (optional — auto-detected for major providers)" placeholder="mail.yourcompany.com" value={imapHost} onChange={e => setImapHost(e.target.value)} />
            <p className="text-xs text-slate-500">Most providers require an App Password. Generate one in your email provider&apos;s security settings, not your regular password.</p>
            <div className="flex gap-3">
              <Button type="submit" loading={connecting}>Connect account</Button>
              <Button type="button" variant="ghost" onClick={() => setShowImapForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

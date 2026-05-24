'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Play, CheckCircle, XCircle, Zap, Mail } from 'lucide-react'
import { api } from '@/lib/api'
import { getProviderIcon } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Account   = { id: string; email: string; type: string; enabled: boolean; created_at: string }
type RunResult = { status: 'completed' | 'failed'; emails_deleted: number; emails_kept: number; error_message?: string }

// ── Fake terminal lines ───────────────────────────────────────────────────
const SPAM_LINES = [
  '🗑  "50% OFF — Flash Sale ends TONIGHT!"            → MARKETING',
  '🗑  "You\'ve been selected for a FREE gift card"     → SPAM',
  '🗑  "Weekly digest: top articles for you"            → NEWSLETTER',
  '🗑  "Your friend liked your photo"                   → SOCIAL',
  '🗑  "Exclusive deals just for you this week"         → MARKETING',
  '🗑  "[Newsletter] Industry insights — May 2026"      → NEWSLETTER',
  '🗑  "Confirm your subscription to DailyDeals"        → NEWSLETTER',
  '🗑  "You have unused rewards points expiring soon"   → MARKETING',
  '🗑  "Introducing our brand new product line!"        → MARKETING',
  '🗑  "Hot offer: 3 months free, cancel anytime"       → MARKETING',
  '🗑  "Re: Your account needs attention ⚠️"            → SPAM',
  '🗑  "You\'re missing out on these great deals"       → MARKETING',
  '🗑  "Monthly roundup — what you missed"              → NEWSLETTER',
  '🗑  "Someone viewed your profile"                    → SOCIAL',
  '🗑  "Limited time: upgrade for 60% less"             → MARKETING',
  '🗑  "Top picks for you this weekend 🛍️"              → MARKETING',
  '🗑  "Alert: your free trial is ending soon"          → MARKETING',
]
const KEEP_LINES = [
  '✅  "Invoice #4821 — April 2026"                     → KEEP',
  '✅  "Re: Meeting tomorrow at 10am"                   → KEEP',
  '✅  "Your order #8873 has been shipped"              → KEEP',
  '✅  "Password reset request"                         → KEEP',
  '✅  "Bank statement available — March"               → KEEP',
]

function buildScript(email: string) {
  const now = new Date()
  const ts = (off = 0) => {
    const d = new Date(now.getTime() + off * 1000)
    return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`
  }
  const count    = Math.floor(Math.random() * 800) + 400
  const shuffled = [...SPAM_LINES, ...KEEP_LINES].sort(() => Math.random() - 0.4).slice(0, 18)
  return [
    { text: '$ Chenesa AI Cleaner v1.0',                                   color: 'text-primary-400', delay: 0 },
    { text: `${ts(0)}  Connecting to IMAP server…`,                        color: 'text-slate-300',   delay: 400 },
    { text: `${ts(1)}  ✓ Authenticated — ${email}`,                        color: 'text-green-400',   delay: 1200 },
    { text: `${ts(2)}  Scanning INBOX folder…`,                            color: 'text-slate-300',   delay: 2000 },
    { text: `${ts(3)}  Found ${count.toLocaleString()} emails`,            color: 'text-yellow-300',  delay: 3000 },
    { text: `${ts(4)}  Filtering by age and read status…`,                 color: 'text-slate-300',   delay: 3800 },
    { text: `${ts(5)}  ${Math.floor(count * 0.4)} emails queued for AI`,   color: 'text-yellow-300',  delay: 4600 },
    { text: `${ts(6)}  Starting Claude AI classifier…`,                    color: 'text-slate-300',   delay: 5400 },
    { text: `${ts(7)}  ────────────────────────────────`,                  color: 'text-slate-600',   delay: 6000 },
    ...shuffled.map((line, i) => ({
      text:  `${ts(7 + i * 0.8)}  ${line}`,
      color: line.startsWith('🗑') ? 'text-red-400' : 'text-green-400',
      delay: 6400 + i * 800,
    })),
    { text: `${ts(23)}  ────────────────────────────────`,                 color: 'text-slate-600',   delay: 6400 + 18 * 800 },
    { text: `${ts(24)}  Deleting flagged emails from server…`,             color: 'text-slate-300',   delay: 6400 + 18 * 800 + 600 },
    { text: `${ts(25)}  ✓ Done.`,                                          color: 'text-green-400',   delay: 6400 + 18 * 800 + 1400 },
  ]
}

const STEPS = ['Connecting to mailbox…','Scanning inbox…','AI is analysing emails…','Removing junk mail…','Finishing up…']

// ── Terminal + progress ───────────────────────────────────────────────────
function RunProgress({ accountEmail, runId, onDone }: {
  accountEmail: string; runId: string; onDone: (r: RunResult) => void
}) {
  const [stepIdx,  setStepIdx]  = useState(0)
  const [progress, setProgress] = useState(5)
  const [logs,     setLogs]     = useState<{ text: string; color: string }[]>([])
  const termRef  = useRef<HTMLDivElement>(null)
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const script = buildScript(accountEmail)
    const scriptDuration = (script.at(-1)?.delay ?? 0) + 800

    // Play initial fake script
    script.forEach(({ text, color, delay }) => {
      timers.current.push(setTimeout(() => {
        setLogs(p => [...p, { text, color }])
      }, delay))
    })

    // After the script ends, loop "still working" tails until backend reports done
    const TAIL_LINES = [
      '⟳  Batch processing in progress…',
      '⟳  Communicating with mail server…',
      '⟳  Applying changes to mailbox…',
      '⟳  Removing flagged messages…',
      '⟳  Expunging deleted items…',
      '⟳  Verifying deletions…',
      '⟳  Almost done…',
    ]
    let tailIdx = 0
    const tail = setInterval(() => {
      const ts = new Date()
      const t = `[${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}]`
      setLogs(p => [...p, { text: `${t}  ${TAIL_LINES[tailIdx % TAIL_LINES.length]}`, color: 'text-slate-600' }])
      tailIdx++
    }, 4000)

    // Delay tail start until initial script finishes
    const tailStart = setTimeout(() => {
      // tail interval already set up, just let it run
    }, scriptDuration)

    const bar  = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, STEPS.length - 1))
      setProgress(p => Math.min(p + 17, 88))
    }, 8000)

    const poll = setInterval(async () => {
      try {
        const run = await api.getRunDetail(runId)
        if (run.status !== 'running') {
          clearInterval(bar); clearInterval(poll); clearInterval(tail)
          setProgress(100)
          const ts = new Date()
          const t = `[${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}]`
          setLogs(p => [...p, { text: `${t}  ✓ Run complete.`, color: 'text-green-400' }])
          setTimeout(() => onDone(run), 1000)
        }
      } catch {}
    }, 3000)

    return () => {
      timers.current.forEach(clearTimeout)
      clearTimeout(tailStart)
      clearInterval(bar); clearInterval(poll); clearInterval(tail)
    }
  }, [runId, accountEmail, onDone])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  return (
    <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden shadow-xl shadow-primary-900/20">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-3xl">{getProviderIcon(accountEmail)}</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full" />
            </div>
            <div>
              <p className="font-semibold text-white">{accountEmail}</p>
              <p className="text-xs text-primary-400 flex items-center gap-1">
                <Zap size={10} className="animate-pulse" /> AI cleaning in progress
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{progress}%</p>
            <p className="text-xs text-slate-500">{STEPS[stepIdx]}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700 ease-out shadow-lg shadow-primary-500/50"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Terminal */}
      <div className="border-t border-slate-700/50 bg-[#070b12]">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-slate-500 font-mono">chenesa — ai cleaner</span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-500 font-mono">running</span>
          </div>
        </div>
        <div ref={termRef} className="h-56 overflow-y-auto overflow-x-hidden px-4 py-3 font-mono text-xs leading-5 scroll-smooth space-y-0.5">
          {logs.length === 0 && <span className="text-slate-600 animate-pulse">Initialising…</span>}
          {logs.map((l, i) => <div key={i} className={l.color}>{l.text}</div>)}
          {logs.length > 0 && <span className="text-slate-500 animate-pulse ml-0.5">█</span>}
        </div>
      </div>
    </div>
  )
}

// ── Result card ───────────────────────────────────────────────────────────
function RunResultCard({ accountEmail, result, onDismiss }: {
  accountEmail: string; result: RunResult; onDismiss: () => void
}) {
  const ok = result.status === 'completed'
  return (
    <div className={`rounded-2xl border p-5 ${ok ? 'border-green-500/30 bg-gradient-to-br from-green-950/40 to-slate-900' : 'border-red-500/30 bg-gradient-to-br from-red-950/40 to-slate-900'}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{getProviderIcon(accountEmail)}</span>
        <div className="flex-1">
          <p className="font-semibold text-white">{accountEmail}</p>
          <p className={`text-xs font-medium ${ok ? 'text-green-400' : 'text-red-400'}`}>
            {ok ? '✓ Clean complete' : '✗ Run failed'}
          </p>
        </div>
        {ok ? <CheckCircle size={22} className="text-green-400" /> : <XCircle size={22} className="text-red-400" />}
      </div>
      {ok ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-3xl font-bold text-white">{result.emails_deleted}</p>
            <p className="text-xs text-slate-400 mt-0.5">🗑 deleted</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-3xl font-bold text-slate-300">{result.emails_kept}</p>
            <p className="text-xs text-slate-400 mt-0.5">✓ kept</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-red-400 mb-4 bg-red-950/30 rounded-lg p-3">{result.error_message ?? 'Unknown error'}</p>
      )}
      <button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Dismiss →</button>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2].map(i => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 bg-slate-700 rounded" />
            <div className="h-2 w-24 bg-slate-800 rounded" />
          </div>
          <div className="h-8 w-20 bg-slate-700 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
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
    const email = activeRun!.email; setActiveRun(null); setRunResult({ email, result })
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
    <div className="w-full max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Email accounts</h1>
        <p className="text-slate-400 mt-1">Connect any mailbox. Chenesa auto-detects provider settings.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/40 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Active run */}
      {activeRun && (
        <RunProgress accountEmail={activeRun.email} runId={activeRun.runId} onDone={handleRunDone} />
      )}

      {/* Run result */}
      {runResult && (
        <RunResultCard accountEmail={runResult.email} result={runResult.result} onDismiss={() => setRunResult(null)} />
      )}

      {/* Account list */}
      {loading ? <Skeleton /> : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <Mail size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No accounts connected yet</p>
          <p className="text-slate-500 text-sm">Add one below to start cleaning</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id}
              className="group rounded-2xl border border-border bg-surface hover:border-primary-500/50 hover:bg-slate-800/60 transition-all duration-200 p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-700/60 flex items-center justify-center text-2xl">
                  {getProviderIcon(acc.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{acc.email}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{acc.type} · connected</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!!activeRun}
                    onClick={() => handleRun(acc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                      bg-gradient-to-r from-primary-600 to-primary-500 text-white
                      hover:from-primary-500 hover:to-primary-400
                      shadow-md shadow-primary-900/40
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-150 active:scale-95"
                  >
                    <Zap size={13} className={activeRun?.accountId === acc.id ? 'animate-pulse' : ''} />
                    {activeRun?.accountId === acc.id ? 'Running…' : 'Run now'}
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Connect a new account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Gmail */}
          <button
            onClick={async () => { try { const { url } = await api.getGmailUrl(); window.location.href = url } catch(e: any) { setError(e.message) }}}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary-500/60 hover:bg-slate-800/60 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl">📧</div>
            <div>
              <p className="font-semibold text-white group-hover:text-primary-300 transition-colors">Gmail</p>
              <p className="text-xs text-slate-400">Sign in with Google OAuth</p>
            </div>
          </button>
          {/* IMAP */}
          <button
            onClick={() => setShowImapForm(v => !v)}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary-500/60 hover:bg-slate-800/60 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">✉️</div>
            <div>
              <p className="font-semibold text-white group-hover:text-primary-300 transition-colors">Any other provider</p>
              <p className="text-xs text-slate-400">Outlook, Yahoo, iCloud, AOL…</p>
            </div>
          </button>
        </div>

        {showImapForm && (
          <form onSubmit={handleConnectImap}
            className="mt-4 rounded-2xl border border-border bg-surface p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Mail size={16} className="text-primary-400" /> Connect via App Password
            </h3>
            <Input label="Email address" type="email" placeholder="you@outlook.com"
              value={imapEmail} onChange={e => setImapEmail(e.target.value)} required />
            <Input label="App Password" type="password" placeholder="xxxx xxxx xxxx xxxx"
              value={imapPassword} onChange={e => setImapPassword(e.target.value)} required />
            <Input label="IMAP host (optional — auto-detected for major providers)"
              placeholder="mail.yourcompany.com"
              value={imapHost} onChange={e => setImapHost(e.target.value)} />
            <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
              💡 Most providers require an App Password, not your regular password. Generate one in your email security settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button type="submit" loading={connecting} className="w-full sm:w-auto">Connect account</Button>
              <Button type="button" variant="ghost" onClick={() => setShowImapForm(false)} className="w-full sm:w-auto">Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

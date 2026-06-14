'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Trash2, CheckCircle, XCircle, Zap, Mail, Bell, Sparkles, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { getProviderIcon } from '@/lib/constants'

type Account    = { id: string; email: string; type: string; enabled: boolean; created_at: string }
type RunResult  = { status: 'completed' | 'failed'; emails_deleted: number; emails_kept: number; error_message?: string }
type Profile    = { free_runs_used: number; free_runs_limit: number; subscription_plan: string }
type CleanupMode = 'safe' | 'aggressive' | 'smart'

// ── Fake terminal lines ───────────────────────────────────────────────────────
const JUNK_LINES = [
  '🗑  "50% OFF — Flash Sale ends TONIGHT!"              → MARKETING (List-Unsubscribe)',
  '🗑  "Weekly digest: top articles for you"             → MARKETING (Precedence: bulk)',
  '🗑  "Your friend liked your photo"                    → SOCIAL (facebook.com)',
  '🗑  "Exclusive deals just for you this week"          → MARKETING (X-Campaign-Id)',
  '🗑  "[Newsletter] Industry insights — May 2026"       → MARKETING (List-Unsubscribe)',
  '🗑  "Confirm your subscription to DailyDeals"         → MARKETING (Precedence: list)',
  '🗑  "You have unused rewards points expiring soon"    → MARKETING (SendGrid mailer)',
  '🗑  "Someone viewed your profile"                     → SOCIAL (linkedin.com)',
  '🗑  "Hot offer: 3 months free, cancel anytime"        → MARKETING (Mailchimp)',
  '🗑  "Re: Your account needs attention ⚠️"             → SPAM (pattern match)',
  '🗑  "Monthly roundup — what you missed"               → MARKETING (Precedence: bulk)',
  '🗑  "Top picks for you this weekend 🛍️"               → MARKETING (Klaviyo mailer)',
  '🗑  "Introducing our brand new product line!"         → MARKETING (X-Campaign-Id)',
  '🗑  "Alert: your free trial is ending soon"           → MARKETING (HubSpot)',
  '🗑  "You\'ve been selected for a FREE gift card"      → SPAM (pattern match)',
]
const KEEP_LINES = [
  '✅  "Invoice #4821 — April 2026"                      → KEEP',
  '✅  "Re: Meeting tomorrow at 10am"                    → KEEP',
  '✅  "Your order #8873 has been shipped"               → KEEP',
  '✅  "Password reset request"                          → KEEP',
  '✅  "Bank statement available — March"                → KEEP',
]

function buildScript(email: string, mode: CleanupMode) {
  const now = new Date()
  const ts = (off = 0) => {
    const d = new Date(now.getTime() + off * 1000)
    return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`
  }
  const count    = Math.floor(Math.random() * 800) + 400
  const oldRead  = Math.floor(count * 0.35)
  const shuffled = [...JUNK_LINES, ...KEEP_LINES].sort(() => Math.random() - 0.4).slice(0, 16)
  const modeLabel = mode === 'safe' ? 'Safe (archive)' : mode === 'smart' ? 'Smart AI (Claude)' : 'Aggressive (delete)'

  return [
    { text: '$ Chenesa Inbox Recovery',                                          color: 'text-primary-400', delay: 0 },
    { text: `${ts(0)}  Connecting to Gmail…`,                                    color: 'text-slate-300',   delay: 400 },
    { text: `${ts(1)}  ✓ Authenticated — ${email}`,                              color: 'text-green-400',   delay: 1200 },
    { text: `${ts(2)}  Scanning INBOX folder…`,                                  color: 'text-slate-300',   delay: 2000 },
    { text: `${ts(3)}  Found ${count.toLocaleString()} emails`,                  color: 'text-yellow-300',  delay: 3000 },
    { text: `${ts(4)}  Applying keep rules…`,                                    color: 'text-slate-300',   delay: 3800 },
    { text: `${ts(5)}  Pre-filtering ${oldRead} old read emails…`,               color: 'text-slate-300',   delay: 4600 },
    { text: `${ts(6)}  Running rules engine (headers · domains · patterns)…`,    color: 'text-slate-300',   delay: 5400 },
    { text: `${ts(7)}  Mode: ${modeLabel}`,                                      color: 'text-primary-400', delay: 6000 },
    { text: `${ts(8)}  ────────────────────────────────`,                        color: 'text-slate-600',   delay: 6400 },
    ...(mode === 'smart' ? [{ text: `${ts(8)}  🤖 Sending unmatched emails to Claude AI…`, color: 'text-primary-400', delay: 6600 }] : []),
    ...shuffled.map((line, i) => ({
      text:  `${ts(8 + i * 0.8)}  ${line}`,
      color: line.startsWith('🗑') ? 'text-red-400' : 'text-green-400',
      delay: 6800 + i * 800,
    })),
    { text: `${ts(28)}  ────────────────────────────────`,                       color: 'text-slate-600',   delay: 6800 + 16 * 800 },
    { text: `${ts(29)}  Applying cleanup actions…`,                              color: 'text-slate-300',   delay: 6800 + 16 * 800 + 600 },
    { text: `${ts(30)}  ✓ Done.`,                                                color: 'text-green-400',   delay: 6800 + 16 * 800 + 1400 },
  ]
}

const STEPS = ['Connecting to Gmail…', 'Scanning inbox…', 'Running rules engine…', 'Cleaning up…', 'Finishing up…']

// ── Cleanup mode config ───────────────────────────────────────────────────────
const MODES: { key: CleanupMode; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    key: 'safe',
    label: 'Safe',
    icon: <Shield size={11} />,
    desc: 'Archive newsletters & social — fully reversible',
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    icon: <Zap size={11} />,
    desc: 'Delete junk, spam & old read emails',
  },
]

// ── Terminal + progress ───────────────────────────────────────────────────────
function RunProgress({ accountEmail, runId, mode, onDone }: {
  accountEmail: string; runId: string; mode: CleanupMode; onDone: (r: RunResult) => void
}) {
  const [stepIdx,  setStepIdx]  = useState(0)
  const [progress, setProgress] = useState(5)
  const [logs,     setLogs]     = useState<{ text: string; color: string }[]>([])
  const termRef  = useRef<HTMLDivElement>(null)
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const script = buildScript(accountEmail, mode)
    const scriptDuration = (script.at(-1)?.delay ?? 0) + 800

    script.forEach(({ text, color, delay }) => {
      timers.current.push(setTimeout(() => {
        setLogs(p => [...p, { text, color }])
      }, delay))
    })

    const TAIL_LINES = [
      '⟳  Rules engine processing…',
      '⟳  Communicating with Gmail…',
      '⟳  Applying changes to mailbox…',
      '⟳  Removing flagged messages…',
      '⟳  Almost done…',
    ]
    let tailIdx = 0
    const tail = setInterval(() => {
      const ts = new Date()
      const t = `[${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}]`
      setLogs(p => [...p, { text: `${t}  ${TAIL_LINES[tailIdx % TAIL_LINES.length]}`, color: 'text-slate-600' }])
      tailIdx++
    }, 4000)

    const tailStart = setTimeout(() => {}, scriptDuration)

    const bar = setInterval(() => {
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
  }, [runId, accountEmail, mode, onDone])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  return (
    <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden shadow-xl shadow-primary-900/20">
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
                <Zap size={10} className="animate-pulse" /> Cleanup in progress
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{progress}%</p>
            <p className="text-xs text-slate-500">{STEPS[stepIdx]}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-700 ease-out shadow-lg shadow-primary-500/50"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="border-t border-slate-700/50 bg-[#070b12]">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-slate-500 font-mono">chenesa — inbox recovery</span>
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

// ── Result card ───────────────────────────────────────────────────────────────
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
            {ok ? '✓ Cleanup complete' : '✗ Run failed'}
          </p>
        </div>
        {ok ? <CheckCircle size={22} className="text-green-400" /> : <XCircle size={22} className="text-red-400" />}
      </div>
      {ok ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-3xl font-bold text-white">{result.emails_deleted}</p>
            <p className="text-xs text-slate-400 mt-0.5">🗑 cleaned</p>
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

// ── Waitlist card (beta) ──────────────────────────────────────────────────────
const WAITLIST_KEY = 'chenesa-waitlist'

function WaitlistCard() {
  const [submitted, setSubmitted] = useState(false)
  const [email,     setEmail]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (localStorage.getItem(WAITLIST_KEY) === '1') setSubmitted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await api.joinWaitlist(email)
      localStorage.setItem(WAITLIST_KEY, '1')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong — please try again.')
    }
    setSending(false)
  }

  return (
    <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-950/50 to-slate-900 p-6 shadow-xl shadow-primary-900/20">
      {submitted ? (
        <div className="text-center py-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">You're on the list!</h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
            We'll email you the moment Chenesa Pro goes live. Thanks for being part of the beta!
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-4 mb-5">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <Sparkles size={20} className="text-primary-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Thank you for testing!</h3>
              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                You've used your free beta run. Join the list for early access to Pro — unlimited cleans + AI Smart Cleanup.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/60 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold
                  hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-primary-900/40 transition-all active:scale-95 whitespace-nowrap"
              >
                {sending ? <span className="animate-pulse">Sending…</span> : <><Bell size={13} /> Notify me</>}
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <p className="text-xs text-slate-600 text-center">No spam, ever. Just a launch notification.</p>
          </form>
        </>
      )}
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map(i => (
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const searchParams   = useSearchParams()
  const connectedEmail = searchParams.get('connected')
  const oauthError     = searchParams.get('error')

  const [accounts,   setAccounts]   = useState<Account[]>([])
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [activeRun,  setActiveRun]  = useState<{ accountId: string; runId: string; email: string; mode: CleanupMode } | null>(null)
  const [runResult,  setRunResult]  = useState<{ email: string; result: RunResult } | null>(null)
  const [modes,      setModes]      = useState<Record<string, CleanupMode>>({})
  const [error,      setError]      = useState('')

  const runsExhausted = profile !== null && profile.free_runs_used >= profile.free_runs_limit
  const isPro = profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'business'

  const load = async () => {
    setLoading(true)
    try {
      const [accs, prefs] = await Promise.all([api.getAccounts(), api.getProfilePrefs()])
      setAccounts(accs)
      setProfile({ free_runs_used: prefs.free_runs_used, free_runs_limit: prefs.free_runs_limit, subscription_plan: prefs.subscription_plan ?? 'free' })
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getMode = (accountId: string): CleanupMode => modes[accountId] ?? 'aggressive'

  const handleRun = async (acc: Account) => {
    setError(''); setRunResult(null)
    const mode = getMode(acc.id)
    try {
      const { run_id } = await api.triggerRun(acc.id, mode)
      setActiveRun({ accountId: acc.id, runId: run_id, email: acc.email, mode })
    } catch (e: any) { setError(e.message) }
  }

  const handleRunDone = async (result: RunResult) => {
    const email = activeRun!.email
    setActiveRun(null)
    setRunResult({ email, result })
    try {
      const prefs = await api.getProfilePrefs()
      setProfile({ free_runs_used: prefs.free_runs_used, free_runs_limit: prefs.free_runs_limit, subscription_plan: prefs.subscription_plan ?? 'free' })
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account?')) return
    await api.deleteAccount(id); load()
  }

  const showWaitlist = runsExhausted || runResult?.result.status === 'completed'

  return (
    <div className="w-full max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Email accounts</h1>
        <p className="text-slate-400 mt-1">Connect your Gmail inbox. Chenesa handles the rest.</p>
      </div>

      {connectedEmail && (
        <div className="rounded-xl bg-green-900/20 border border-green-700/40 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
          <CheckCircle size={16} /> <strong>{connectedEmail}</strong> connected successfully — ready to clean!
        </div>
      )}

      {oauthError && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/40 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <XCircle size={16} />
          {oauthError === 'token_exchange_failed' && 'Gmail authorisation failed — the link may have expired. Please try again.'}
          {oauthError === 'gmail_api_failed'      && 'Could not fetch your Gmail profile. Check that the Gmail API is enabled in Google Cloud Console.'}
          {oauthError === 'save_failed'           && 'Account connected but failed to save — please try again.'}
          {!['token_exchange_failed','gmail_api_failed','save_failed'].includes(oauthError) && `OAuth error: ${oauthError}`}
        </div>
      )}

      {error && (
        error.toLowerCase().includes('upgrade') ? (
          <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-r from-amber-950/40 to-slate-900/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-300 text-sm">Free cleans used up</p>
                <p className="text-xs text-amber-500/80 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-red-900/20 border border-red-700/40 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <XCircle size={16} /> {error}
          </div>
        )
      )}

      {/* Active run */}
      {activeRun && (
        <RunProgress
          accountEmail={activeRun.email}
          runId={activeRun.runId}
          mode={activeRun.mode}
          onDone={handleRunDone}
        />
      )}

      {/* Run result */}
      {runResult && (
        <RunResultCard accountEmail={runResult.email} result={runResult.result} onDismiss={() => setRunResult(null)} />
      )}

      {/* Beta waitlist card */}
      {showWaitlist && <WaitlistCard />}

      {/* Account list */}
      {loading ? <Skeleton /> : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <Mail size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No accounts connected yet</p>
          <p className="text-slate-500 text-sm">Connect your Gmail inbox below to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => {
            const mode = getMode(acc.id)
            const isRunning = activeRun?.accountId === acc.id
            return (
              <div key={acc.id}
                className="group rounded-2xl border border-border bg-surface hover:border-primary-500/50 hover:bg-slate-800/60 transition-all duration-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-700/60 flex items-center justify-center text-2xl">
                    {getProviderIcon(acc.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{acc.email}</p>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">{acc.type} · connected</p>

                    {/* Cleanup mode selector */}
                    {!runsExhausted && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-xs text-slate-600">Mode:</span>
                        {MODES.map(m => (
                          <button
                            key={m.key}
                            title={m.desc}
                            disabled={isRunning}
                            onClick={() => setModes(prev => ({ ...prev, [acc.id]: m.key }))}
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all duration-150 ${
                              mode === m.key
                                ? 'bg-primary-600/80 text-white shadow-sm shadow-primary-900/40'
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {m.icon} {m.label}
                          </button>
                        ))}
                        {/* Smart Cleanup — enabled for Pro, teaser for free */}
                        <button
                          disabled={!isPro || isRunning}
                          title={isPro ? 'AI Smart Cleanup — Claude classifies what rules can\'t decide' : 'Requires Pro plan'}
                          onClick={() => isPro && setModes(prev => ({ ...prev, [acc.id]: 'smart' }))}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all duration-150 ${
                            mode === 'smart' && isPro
                              ? 'bg-primary-600/80 text-white shadow-sm shadow-primary-900/40'
                              : isPro
                                ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <Sparkles size={10} />
                          {' '}Smart
                          {!isPro && <span className="text-[10px] ml-0.5 text-primary-600">Pro</span>}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {runsExhausted ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                        bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed select-none">
                        <CheckCircle size={13} className="text-slate-600" />
                        Test run used
                      </div>
                    ) : (
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
                        <Zap size={13} className={isRunning ? 'animate-pulse' : ''} />
                        {isRunning ? 'Running…' : 'Run now'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Connect section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Connect a new account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Gmail */}
          <button
            onClick={async () => {
              try {
                const { url } = await api.getGmailUrl()
                window.location.href = url
              } catch (e: any) { setError(e.message) }
            }}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary-500/60 hover:bg-slate-800/60 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl">📧</div>
            <div>
              <p className="font-semibold text-white group-hover:text-primary-300 transition-colors">Gmail</p>
              <p className="text-xs text-slate-400">Sign in with Google OAuth</p>
            </div>
          </button>

          {/* Other providers — Coming Soon */}
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-800/20 p-4 cursor-default">
            <div className="w-10 h-10 rounded-xl bg-slate-700/40 border border-slate-700/60 flex items-center justify-center text-xl opacity-50">✉️</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-500">More providers</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-500 border border-slate-700 font-medium tracking-wide uppercase">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">Outlook · Yahoo · iCloud · AOL · Zoho</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

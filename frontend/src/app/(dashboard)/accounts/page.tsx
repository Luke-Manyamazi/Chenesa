'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Play, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { getProviderIcon } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

type Account = { id: string; email: string; type: string; enabled: boolean; created_at: string }

type RunResult = { status: 'completed' | 'failed'; emails_deleted: number; emails_kept: number; error_message?: string }

const STEPS = [
  'Connecting to mailbox…',
  'Scanning inbox…',
  'AI is analysing emails…',
  'Removing junk mail…',
  'Almost done…',
]

function RunProgress({ accountEmail, runId, onDone }: {
  accountEmail: string
  runId: string
  onDone: (result: RunResult) => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(8)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Animate progress bar and cycle messages
    intervalRef.current = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, STEPS.length - 1))
      setProgress(p => Math.min(p + 18, 88)) // cap at 88 until real completion
    }, 6000)

    // Poll backend for completion
    pollRef.current = setInterval(async () => {
      try {
        const run = await api.getRunDetail(runId)
        if (run.status !== 'running') {
          clearInterval(intervalRef.current!)
          clearInterval(pollRef.current!)
          setProgress(100)
          setTimeout(() => onDone(run), 600) // brief pause to show 100%
        }
      } catch {}
    }, 3000)

    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(pollRef.current!)
    }
  }, [runId, onDone])

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getProviderIcon(accountEmail)}</span>
          <div>
            <p className="font-medium text-white">{accountEmail}</p>
            <p className="text-xs text-primary-400 animate-pulse">Cleaning in progress…</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-sm text-slate-300">{STEPS[stepIdx]}</p>
            <p className="text-xs text-slate-500">{progress}%</p>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">⏱ Usually takes 30–90 seconds</p>
      </div>
    </Card>
  )
}

function RunResultCard({ accountEmail, result, onDismiss }: {
  accountEmail: string
  result: RunResult
  onDismiss: () => void
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

        <div className="h-2 rounded-full bg-slate-700">
          <div className={`h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: '100%' }} />
        </div>

        <button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-300">
          Dismiss
        </button>
      </div>
    </Card>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRun, setActiveRun] = useState<{ accountId: string; runId: string; email: string } | null>(null)
  const [runResult, setRunResult] = useState<{ email: string; result: RunResult } | null>(null)
  const [showImapForm, setShowImapForm] = useState(false)
  const [imapEmail, setImapEmail] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setAccounts(await api.getAccounts()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRun = async (acc: Account) => {
    setError('')
    setRunResult(null)
    try {
      const { run_id } = await api.triggerRun(acc.id)
      setActiveRun({ accountId: acc.id, runId: run_id, email: acc.email })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleRunDone = (result: RunResult) => {
    const email = activeRun!.email
    setActiveRun(null)
    setRunResult({ email, result })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account?')) return
    await api.deleteAccount(id)
    load()
  }

  const handleConnectImap = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnecting(true)
    setError('')
    try {
      await api.connectImap({ email: imapEmail, app_password: imapPassword, imap_host: imapHost || undefined })
      setShowImapForm(false)
      setImapEmail(''); setImapPassword(''); setImapHost('')
      load()
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

      {/* Active run progress */}
      {activeRun && (
        <RunProgress
          accountEmail={activeRun.email}
          runId={activeRun.runId}
          onDone={handleRunDone}
        />
      )}

      {/* Run result */}
      {runResult && (
        <RunResultCard
          accountEmail={runResult.email}
          result={runResult.result}
          onDismiss={() => setRunResult(null)}
        />
      )}

      {/* Account list */}
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
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!!activeRun}
                    onClick={() => handleRun(acc)}
                  >
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

      {/* Connect new account */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Connect a new account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={async () => { try { const { url } = await api.getGmailUrl(); window.location.href = url } catch(e: any) { setError(e.message) } }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary-500 transition-colors text-left"
          >
            <span className="text-2xl">📧</span>
            <div>
              <p className="font-medium text-white">Gmail</p>
              <p className="text-xs text-slate-400">Sign in with Google OAuth</p>
            </div>
          </button>
          <button onClick={() => setShowImapForm(v => !v)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary-500 transition-colors text-left">
            <span className="text-2xl">✉️</span>
            <div>
              <p className="font-medium text-white">Any other provider</p>
              <p className="text-xs text-slate-400">Outlook, Yahoo, iCloud, AOL, Zoho…</p>
            </div>
          </button>
        </div>

        {showImapForm && (
          <form onSubmit={handleConnectImap} className="mt-4 rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="font-semibold text-white">Connect via App Password</h3>
            <Input label="Email address" type="email" placeholder="you@outlook.com" value={imapEmail} onChange={e => setImapEmail(e.target.value)} required />
            <Input label="App Password" type="password" placeholder="xxxx xxxx xxxx xxxx" value={imapPassword} onChange={e => setImapPassword(e.target.value)} required />
            <Input label="IMAP host (optional — auto-detected for major providers)" placeholder="mail.yourcompany.com" value={imapHost} onChange={e => setImapHost(e.target.value)} />
            <p className="text-xs text-slate-500">
              Most providers require an App Password. Generate one in your email provider&apos;s security settings, not your regular password.
            </p>
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

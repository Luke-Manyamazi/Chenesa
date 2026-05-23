'use client'
import { useState, useEffect } from 'react'
import { Trash2, Play, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { getProviderIcon } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

type Account = { id: string; email: string; type: string; enabled: boolean; created_at: string }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [showImapForm, setShowImapForm] = useState(false)
  const [imapEmail, setImapEmail] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    try { setAccounts(await api.getAccounts()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRun = async (accountId: string) => {
    setRunningId(accountId)
    try {
      const { run_id } = await api.triggerRun(accountId)
      // Poll until done
      const poll = setInterval(async () => {
        const run = await api.getRunDetail(run_id)
        if (run.status !== 'running') {
          clearInterval(poll)
          setRunningId(null)
          setSuccess(`Clean complete — ${run.emails_deleted} emails deleted!`)
          setTimeout(() => setSuccess(''), 4000)
        }
      }, 3000)
    } catch (e: any) {
      setError(e.message)
      setRunningId(null)
    }
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

      {success && <div className="rounded-lg bg-green-900/30 border border-green-700/50 px-4 py-3 text-sm text-green-300">{success}</div>}
      {error   && <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>}

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
                  <Button size="sm" variant="secondary" loading={runningId === acc.id}
                    onClick={() => handleRun(acc.id)}>
                    <Play size={14} /> Run now
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
          <button onClick={async () => { const { url } = await api.getGmailUrl(); window.location.href = url }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary-500 transition-colors text-left">
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
            <Input label="App Password" type="password" placeholder="xxxx xxxx xxxx xxxx"
              value={imapPassword} onChange={e => setImapPassword(e.target.value)} required />
            <Input label="IMAP host (optional — auto-detected for major providers)" placeholder="mail.yourcompany.com"
              value={imapHost} onChange={e => setImapHost(e.target.value)} />
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

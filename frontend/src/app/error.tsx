'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Mail, Home } from 'lucide-react'
import Logo from '@/components/ui/Logo'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Chenesa error]', error)
  }, [error])

  const subject = encodeURIComponent('Chenesa App Error Report')
  const body = encodeURIComponent(
    `Hi Chenesa Support,\n\nI encountered an error in the app.\n\n` +
    `Error: ${error?.message ?? 'Unknown error'}\n` +
    `Digest: ${error?.digest ?? 'N/A'}\n` +
    `Page: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}\n` +
    `Time: ${new Date().toISOString()}\n\n` +
    `Please help me resolve this.\n\nThank you`
  )
  const mailtoLink = `mailto:lmanyamazi@gmail.com?subject=${subject}&body=${body}`

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-12">
        <Logo size={32} />
        <span className="text-xl font-bold text-white tracking-tight">Chenesa</span>
      </Link>

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20
        flex items-center justify-center mb-6">
        <AlertTriangle size={28} className="text-red-400" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
        Something went wrong
      </h1>
      <p className="text-slate-400 max-w-sm mb-6 leading-relaxed">
        Chenesa hit an unexpected error. Try refreshing — if it keeps happening,
        send us the details below and we'll fix it fast.
      </p>

      {/* Error detail box */}
      {error?.message && (
        <div className="w-full max-w-md mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Error details</p>
          <p className="text-xs text-red-300 font-mono break-all leading-relaxed">
            {error.message}
          </p>
          {error.digest && (
            <p className="text-[10px] text-red-700 mt-1.5 font-mono">ref: {error.digest}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold
            hover:opacity-90 transition-opacity shadow-lg shadow-primary-900/40">
          <RefreshCw size={14} /> Try again
        </button>
        <a
          href={mailtoLink}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            border border-red-700/40 bg-red-950/20 text-red-400 text-sm font-medium
            hover:border-red-600/60 hover:text-red-300 transition-colors">
          <Mail size={14} /> Send error to support
        </a>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            border border-border bg-surface text-slate-300 text-sm font-medium
            hover:border-primary-500/50 hover:text-white transition-colors">
          <Home size={14} /> Dashboard
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-14 space-y-1">
        <p className="text-[11px] text-slate-700">
          A <span className="text-slate-600 font-medium">Camluk Technologies</span> AI Solutions product
        </p>
        <p className="text-[11px] text-slate-700">
          © 2026 Chenesa. Built with AI. Your emails, your privacy.
        </p>
      </div>

    </div>
  )
}

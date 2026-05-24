import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import { Home, ArrowLeft, Mail } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-12">
        <Logo size={32} />
        <span className="text-xl font-bold text-white tracking-tight">Chenesa</span>
      </Link>

      {/* 404 */}
      <div className="relative mb-6 select-none">
        <p className="text-[120px] sm:text-[160px] font-extrabold leading-none
          bg-gradient-to-br from-primary-400 via-primary-500 to-violet-600
          bg-clip-text text-transparent tracking-tight">
          404
        </p>
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-violet-600/10 blur-3xl -z-10 rounded-full" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
        Page not found
      </h1>
      <p className="text-slate-400 max-w-sm mb-10 leading-relaxed">
        The page you're looking for doesn't exist or has been moved.
        Head back to the dashboard and carry on cleaning.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold
            hover:opacity-90 transition-opacity shadow-lg shadow-primary-900/40">
          <Home size={14} /> Go to dashboard
        </Link>
        <Link href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            border border-border bg-surface text-slate-300 text-sm font-medium
            hover:border-primary-500/50 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>

      {/* Support */}
      <p className="mt-10 text-xs text-slate-600">
        Something broken?{' '}
        <a href="mailto:lmanyamazi@gmail.com?subject=Chenesa%20Issue%20Report"
          className="text-primary-500 hover:text-primary-400 transition-colors inline-flex items-center gap-1">
          <Mail size={11} /> Contact support
        </a>
      </p>

      {/* Footer */}
      <div className="mt-12 space-y-1">
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

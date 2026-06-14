import Link from 'next/link'
import { XCircle, ArrowLeft } from 'lucide-react'

export default function BillingCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 max-w-md mx-auto">

      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <XCircle size={32} className="text-amber-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Payment cancelled</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          No charge was made. You can upgrade any time from the billing page.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Link href="/upgrade"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          Try again
        </Link>
        <Link href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border text-slate-300 text-sm font-medium hover:border-slate-600 transition-colors">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>

    </div>
  )
}

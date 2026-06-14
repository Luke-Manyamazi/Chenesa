import Link from 'next/link'
import { CheckCircle, Zap } from 'lucide-react'

export default function BillingSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 max-w-md mx-auto">

      <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
        <CheckCircle size={32} className="text-green-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">You&apos;re subscribed!</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Your PayFast payment was successful. Your plan has been upgraded — enjoy unlimited cleaning runs.
        </p>
      </div>

      <div className="rounded-2xl border border-green-500/20 bg-green-950/20 px-6 py-4 text-sm text-green-400 w-full">
        It may take up to 60 seconds for your plan to activate. Refresh the dashboard if you still see the Free plan.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Link href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Zap size={14} /> Go to dashboard
        </Link>
        <Link href="/upgrade"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border text-slate-300 text-sm font-medium hover:border-slate-600 transition-colors">
          Manage subscription
        </Link>
      </div>

    </div>
  )
}

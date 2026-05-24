'use client'
import Link from 'next/link'
import { Zap, Shield, Mail, Clock, CheckCircle, ArrowLeft, Bell } from 'lucide-react'

const plans = [
  {
    name: 'Basic',
    price: '$4',
    period: '/month',
    color: 'border-blue-500/30 from-blue-950/30',
    accent: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    features: [
      '500 emails per run',
      '2 connected accounts',
      'Unlimited cleans',
      'Keep rules',
      'Cleaning history',
    ],
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    color: 'border-primary-500/40 from-primary-950/30',
    accent: 'text-primary-400',
    badge: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    highlight: true,
    features: [
      '2,000 emails per run',
      '5 connected accounts',
      'Unlimited cleans',
      'Keep rules',
      'Cleaning history',
      'Priority support',
    ],
  },
]

export default function UpgradePage() {
  return (
    <div className="w-full max-w-2xl space-y-8">

      {/* Back */}
      <Link href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-400 mb-2">
          <Bell size={11} className="animate-pulse" /> Coming soon
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Upgrade Chenesa</h1>
        <p className="text-slate-400 max-w-md mx-auto">
          Paid plans are coming soon. Leave your email and we'll notify you the moment billing goes live — early supporters get a discount.
        </p>
      </div>

      {/* Plan cards — preview */}
      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map(plan => (
          <div key={plan.name}
            className={`relative rounded-2xl border bg-gradient-to-br ${plan.color} to-slate-900/50 p-6 space-y-5
              ${plan.highlight ? 'ring-1 ring-primary-500/30' : ''}`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-900/40">
                  Most popular
                </span>
              </div>
            )}
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${plan.badge}`}>
                {plan.name}
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle size={13} className={plan.accent} />
                  {f}
                </li>
              ))}
            </ul>
            <button disabled
              className="w-full py-2.5 rounded-xl bg-slate-700/60 border border-slate-600/40 text-slate-500 text-sm font-semibold cursor-not-allowed">
              Coming soon
            </button>
          </div>
        ))}
      </div>

      {/* Notify CTA */}
      <div className="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-950/40 to-slate-900/80 p-6 text-center space-y-4">
        <div className="w-10 h-10 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto">
          <Bell size={18} className="text-primary-400" />
        </div>
        <div>
          <p className="font-semibold text-white">Get notified when billing launches</p>
          <p className="text-sm text-slate-400 mt-1">Early supporters get <span className="text-primary-400 font-medium">20% off</span> their first 3 months.</p>
        </div>
        <a href="mailto:it@torgaoptical.co.za?subject=Chenesa%20Early%20Access&body=I%20want%20to%20be%20notified%20when%20Chenesa%20paid%20plans%20launch."
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary-900/40">
          <Bell size={14} /> Notify me
        </a>
      </div>

      {/* Current free plan info */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Zap size={14} className="text-slate-400" /> You're on the Free plan
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Emails/run', value: '100', icon: Mail },
            { label: 'Accounts', value: '1', icon: Shield },
            { label: 'Free cleans', value: '3', icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-slate-800/40 border border-slate-700/40 py-3">
              <Icon size={14} className="text-slate-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 pb-4 text-center space-y-1">
        <p className="text-[11px] text-slate-600">
          A <span className="text-slate-500 font-medium">Camluk Technologies</span> AI Solutions product
        </p>
        <p className="text-[11px] text-slate-700">
          © 2026 Chenesa. Built with AI. Your emails, your privacy.
        </p>
      </div>

    </div>
  )
}

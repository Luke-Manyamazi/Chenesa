'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Zap, Shield, Mail, CheckCircle, ArrowLeft,
  Loader2, AlertCircle, Crown, Building2,
} from 'lucide-react'
import { api } from '@/lib/api'

// ── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'pro',
    name: 'Pro',
    price: 'R99',
    period: '/month',
    color: 'border-primary-500/40 from-primary-950/30',
    accent: 'text-primary-400',
    badge: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    btnClass: 'bg-gradient-to-r from-primary-600 to-primary-500 hover:opacity-90 text-white shadow-lg shadow-primary-900/30',
    highlight: true,
    icon: Crown,
    features: [
      '2,000 emails per run',
      '5 connected accounts',
      'Unlimited cleans',
      'Smart AI classification',
      'Keep rules',
      'Priority support',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: 'R299',
    period: '/month',
    color: 'border-amber-500/30 from-amber-950/20',
    accent: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btnClass: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:opacity-90 text-white shadow-lg shadow-amber-900/30',
    highlight: false,
    icon: Building2,
    features: [
      'Unlimited emails per run',
      'Unlimited accounts',
      'Unlimited cleans',
      'Smart AI classification',
      'Keep rules',
      'Team management',
      'Priority support',
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UpgradePage() {
  const [currentPlan,  setCurrentPlan]  = useState<string>('free')
  const [subscribing,  setSubscribing]  = useState<string | null>(null)
  const [cancelling,   setCancelling]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    api.getProfilePrefs()
      .then(d => setCurrentPlan(d.subscription_plan ?? 'free'))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubscribe = async (planKey: string) => {
    setSubscribing(planKey); setError(null)
    try {
      const { action, fields } = await api.checkoutBilling(planKey)
      // Build and auto-submit a hidden form to PayFast
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = action
      Object.entries(fields as Record<string, string>).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = k; input.value = v
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setSubscribing(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You will revert to the Free plan immediately.')) return
    setCancelling(true); setError(null)
    try {
      await api.cancelSubscription()
      setCurrentPlan('free')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancellation failed')
    } finally {
      setCancelling(false)
    }
  }

  const isPaid = currentPlan === 'pro' || currentPlan === 'business'

  return (
    <div className="w-full max-w-2xl space-y-8">

      {/* Back */}
      <Link href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Upgrade Chenesa</h1>
        <p className="text-slate-400">Paid monthly via PayFast · Cancel any time · Prices in ZAR</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {PLANS.map(plan => {
          const isCurrentPlan = currentPlan === plan.key
          const Icon = plan.icon
          return (
            <div key={plan.key}
              className={`relative rounded-2xl border bg-gradient-to-br ${plan.color} to-slate-900/50 p-6 space-y-5
                ${plan.highlight ? 'ring-1 ring-primary-500/30' : ''}
                ${isCurrentPlan ? 'ring-2 ring-green-500/40' : ''}`}>

              {plan.highlight && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-900/40">
                    Most popular
                  </span>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold">
                    Current plan
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={plan.accent} />
                  <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${plan.badge}`}>
                    {plan.name}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle size={13} className={plan.accent} /> {f}
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <button
                  onClick={handleCancel}
                  disabled={cancelling || loading}
                  className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 text-sm font-semibold hover:bg-red-950/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {cancelling ? <><Loader2 size={13} className="animate-spin" /> Cancelling…</> : 'Cancel subscription'}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={!!subscribing || loading}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 ${plan.btnClass}`}>
                  {subscribing === plan.key
                    ? <><Loader2 size={13} className="animate-spin" /> Redirecting to PayFast…</>
                    : `Subscribe · ${plan.price}/mo`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Current free plan info */}
      {!isPaid && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap size={14} className="text-slate-400" /> You&apos;re on the Free plan
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Emails/run', value: '100', icon: Mail },
              { label: 'Accounts',   value: '1',   icon: Shield },
              { label: 'Free cleans',value: '1',   icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-slate-800/40 border border-slate-700/40 py-3">
                <Icon size={14} className="text-slate-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 pb-4 text-center space-y-1">
        <p className="text-[11px] text-slate-600">
          Payments processed securely by <span className="text-slate-500 font-medium">PayFast</span> · South Africa
        </p>
        <p className="text-[11px] text-slate-600">
          A <span className="text-slate-500 font-medium">Camluk Technologies</span> AI Solutions product
        </p>
      </div>

    </div>
  )
}

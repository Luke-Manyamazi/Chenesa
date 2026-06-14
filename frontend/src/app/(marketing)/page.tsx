import Link from 'next/link'
import {
  Ban, Megaphone, Users, Clock,
  Mail, Zap, Shield, CheckCircle,
  ArrowRight, BarChart3, Star, HardDrive,
} from 'lucide-react'
import Logo from '@/components/ui/Logo'

// ── Data ─────────────────────────────────────────────────────────────────────

const deleteCards = [
  { icon: Ban,       label: 'Spam & Phishing',        desc: 'Scams, fake invoices, lottery emails — gone instantly.',                color: 'text-red-400',    bg: 'bg-red-500/10    border-red-500/20'    },
  { icon: Megaphone, label: 'Marketing & Newsletters', desc: 'Promotions, sales, "we miss you" emails — permanently removed.',       color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { icon: Users,     label: 'Social Notifications',   desc: 'Facebook, LinkedIn, Twitter digests — cleared away automatically.',    color: 'text-blue-400',   bg: 'bg-blue-500/10   border-blue-500/20'   },
  { icon: Clock,     label: 'Old Read Emails',         desc: 'Emails you\'ve already read and no longer need — safely archived.',   color: 'text-slate-400',  bg: 'bg-slate-500/10  border-slate-500/20'  },
]

const keepItems = [
  { emoji: '👤', text: 'Personal emails from real people' },
  { emoji: '💼', text: 'Work correspondence & meeting invites' },
  { emoji: '🧾', text: 'Receipts & order confirmations' },
  { emoji: '🏥', text: 'Medical & legal documents' },
  { emoji: '🔐', text: 'Security alerts & 2FA codes' },
  { emoji: '💰', text: 'Payslips & salary slips' },
  { emoji: '🏦', text: 'Bank statements & invoices' },
  { emoji: '✈️', text: 'Travel bookings & confirmations' },
]

const steps = [
  {
    n: '01', icon: Mail,
    title: 'Connect your Gmail',
    desc: 'Sign in with Google OAuth in under 2 minutes. We only request the permissions needed to read and clean your inbox.',
    color: 'from-blue-950/60 border-blue-500/20 text-blue-400',
  },
  {
    n: '02', icon: HardDrive,
    title: 'Analyse your storage',
    desc: 'Chenesa scans up to 1,000 emails and shows you exactly what is eating your Gmail storage — by category and sender.',
    color: 'from-primary-950/60 border-primary-500/20 text-primary-400',
  },
  {
    n: '03', icon: Shield,
    title: 'Clean up & recover space',
    desc: 'Junk is trashed or archived (recoverable for 30 days). Work, financial, and personal emails are always protected.',
    color: 'from-green-950/60 border-green-500/20 text-green-400',
  },
]

const comingSoon = [
  { name: 'Outlook', icon: '📘' },
  { name: 'Yahoo Mail', icon: '💜' },
  { name: 'iCloud Mail', icon: '☁️' },
  { name: 'AOL Mail', icon: '🔵' },
]

const plans = [
  {
    name: 'Free', price: 'R0', highlight: false,
    badge: 'bg-slate-700/60 text-slate-300 border-slate-600/40',
    accent: 'text-slate-300',
    features: ['1 free cleanup run', '100 emails per run', '1 Gmail account', 'Rules-based cleanup', 'Storage analyser', 'Cleaning history'],
    cta: 'Start free', href: '/signup', ctaStyle: 'border border-border hover:border-primary-500/60 text-slate-300 hover:text-white',
  },
  {
    name: 'Pro', price: 'R99', period: '/mo', highlight: true,
    badge: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    accent: 'text-primary-400',
    features: ['Unlimited cleanup runs', '2,000 emails per run', '5 Gmail accounts', 'AI Smart Cleanup (Claude)', 'Auto-scheduler (6h)', 'Storage analyser', 'Full history & reasoning', 'Keep rules'],
    cta: 'Coming soon', href: '/signup', ctaStyle: 'border border-border text-slate-500 cursor-not-allowed',
  },
  {
    name: 'Business', price: 'R299', period: '/mo', highlight: false,
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    accent: 'text-amber-400',
    features: ['Everything in Pro', '5,000 emails per run', 'Team accounts', 'Scheduled cleanups', 'Admin dashboard', 'Priority support'],
    cta: 'Coming soon', href: '/signup', ctaStyle: 'border border-border text-slate-500 cursor-not-allowed',
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-background text-slate-100 overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative mx-auto max-w-6xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">

        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px]
            bg-gradient-radial from-primary-600/20 via-primary-900/10 to-transparent blur-3xl" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary-700/50
          bg-primary-900/30 px-4 py-1.5 text-sm text-primary-300 mb-8">
          <Star size={12} className="fill-primary-400 text-primary-400" />
          Gmail Storage Recovery — free to start
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white text-balance leading-[1.08] mb-6">
          Reclaim your{' '}
          <span className="bg-gradient-to-r from-primary-400 via-violet-400 to-primary-300
            bg-clip-text text-transparent">
            Gmail storage.
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-10">
          Chenesa scans your Gmail inbox, shows you exactly what is eating your storage,
          then automatically removes spam, marketing emails, and old clutter.
          Your important emails are always protected.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              rounded-xl bg-gradient-to-r from-primary-600 to-primary-500
              px-8 py-4 text-base font-semibold text-white
              hover:opacity-90 transition-opacity shadow-xl shadow-primary-900/50">
            <Zap size={16} className="fill-white" /> Recover my storage — free
          </Link>
          <a href="#how"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              rounded-xl border border-border px-8 py-4 text-base font-medium text-slate-300
              hover:border-primary-500/60 hover:text-white transition-colors">
            See how it works <ArrowRight size={15} />
          </a>
        </div>

        {/* Hero mockup — storage recovery result card */}
        <div className="mx-auto max-w-sm">
          <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-950/40 to-slate-900 p-5 text-left shadow-2xl shadow-primary-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center text-xl">📧</div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">you@gmail.com</p>
                <p className="text-xs text-primary-400 font-medium flex items-center gap-1">
                  <HardDrive size={10} /> Storage analysis complete
                </p>
              </div>
              <CheckCircle size={20} className="text-green-400" />
            </div>
            {/* Recovery bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Recoverable storage</span>
                <span className="text-primary-400 font-bold">2.4 GB</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-400" style={{ width: '73%' }} />
              </div>
              <p className="text-[10px] text-slate-600 mt-1">73% of your inbox storage can be freed</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-2.5 text-center">
                <p className="text-base font-bold text-orange-400">1.2 GB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Marketing</p>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-center">
                <p className="text-base font-bold text-red-400">820 MB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Spam</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
                <p className="text-base font-bold text-blue-400">380 MB</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Social</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-3">Illustrative result — your breakdown will vary</p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '2.4 GB',  label: 'Avg. recoverable storage', color: 'text-primary-400', border: 'border-primary-500/20 from-primary-950/30' },
            { value: '< 60s',   label: 'Inbox analysis time',      color: 'text-green-400',   border: 'border-green-500/20  from-green-950/30'   },
            { value: '99%',     label: 'Classification accuracy',   color: 'text-amber-400',   border: 'border-amber-500/20  from-amber-950/30'   },
            { value: '30 days', label: 'Trash recovery window',     color: 'text-blue-400',    border: 'border-blue-500/20   from-blue-950/30'    },
          ].map(s => (
            <div key={s.label}
              className={`rounded-2xl border ${s.border} bg-gradient-to-br to-slate-900/50 p-5 text-center`}>
              <p className={`text-3xl font-extrabold ${s.color} tracking-tight`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-10 pb-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-500 mb-3">Simple process</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">How Chenesa works</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {steps.map(({ n, icon: Icon, title, desc, color }) => {
            const [from, border, accent] = color.split(' ')
            return (
              <div key={n}
                className={`rounded-2xl border ${border} bg-gradient-to-br ${from} to-slate-900/50 p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl border ${border} bg-slate-900/60
                    flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={accent} />
                  </div>
                  <span className={`text-3xl font-extrabold ${accent} opacity-30 leading-none`}>{n}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── WHAT GETS DELETED / KEPT ── */}
      <section className="border-t border-border bg-surface/20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-500 mb-3">Smart classification</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Rules-first. Always safe.</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
              Chenesa uses a deterministic rules engine before any AI — so free users get accurate results at zero AI cost.
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">

            {/* Deleted */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Ban size={14} className="text-red-400" />
                </div>
                <h3 className="font-bold text-white text-lg">What gets removed</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {deleteCards.map(({ icon: Icon, label, desc, color, bg }) => (
                  <div key={label}
                    className="rounded-2xl border border-border bg-surface p-4
                      hover:border-slate-600/80 transition-colors">
                    <div className={`w-9 h-9 rounded-xl border ${bg} flex items-center justify-center mb-3`}>
                      <Icon size={16} className={color} />
                    </div>
                    <p className="font-semibold text-white text-sm mb-1">{label}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Kept */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Shield size={14} className="text-green-400" />
                </div>
                <h3 className="font-bold text-white text-lg">What&apos;s always protected</h3>
              </div>
              <div className="rounded-2xl border border-green-800/30 bg-gradient-to-br from-green-950/20 to-slate-900/50 p-6 h-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-4">
                  These are never deleted — guaranteed
                </p>
                <div className="space-y-3">
                  {keepItems.map(({ emoji, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <span className="text-base flex-shrink-0">{emoji}</span>
                      <p className="text-sm text-slate-300">{text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-green-900/40">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Plus, set your own <span className="text-green-400 font-medium">keep rules</span> —
                    keywords that always protect matching emails, no matter what.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-500 mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Simple, honest pricing</h2>
          <p className="text-slate-400">Start free. Upgrade when you&apos;re ready. Prices in ZAR.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col
                ${plan.highlight
                  ? 'border-primary-500/40 bg-gradient-to-br from-primary-950/40 to-slate-900 shadow-xl shadow-primary-900/20 ring-1 ring-primary-500/20'
                  : 'border-border bg-surface'
                }`}>
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-900/40">
                    Most popular
                  </span>
                </div>
              )}
              <div className="mb-5">
                <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${plan.badge} mb-3`}>
                  {plan.name}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  {plan.period && <span className="text-slate-500 text-sm">{plan.period}</span>}
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle size={14} className={`${plan.accent} flex-shrink-0 mt-0.5`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.href}
                className={`rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${plan.ctaStyle}
                  ${plan.highlight ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:opacity-90 shadow-lg shadow-primary-900/30 border-0' : ''}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMING SOON PROVIDERS ── */}
      <section className="border-t border-border bg-surface/20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-3">On the roadmap</p>
            <h2 className="text-2xl font-bold text-white mb-2">Gmail now. More coming soon.</h2>
            <p className="text-sm text-slate-500">We&apos;re focused on doing Gmail exceptionally well first.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {comingSoon.map(({ name, icon }) => (
              <div key={name}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-700/60
                  bg-slate-900/30 px-5 py-3 text-slate-500">
                <span className="text-xl grayscale opacity-50">{icon}</span>
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs bg-slate-800 text-slate-600 px-2 py-0.5 rounded-full border border-slate-700/40">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full
            border border-primary-700/40 bg-primary-900/20 text-sm text-primary-300">
            <BarChart3 size={14} /> Scan your inbox in under 60 seconds
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to recover your Gmail storage?
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            1 free cleanup run. No credit card. Takes 2 minutes to connect.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                rounded-xl bg-gradient-to-r from-primary-600 to-primary-500
                px-8 py-4 text-base font-semibold text-white
                hover:opacity-90 transition-opacity shadow-xl shadow-primary-900/50">
              <Zap size={16} className="fill-white" /> Recover my storage — free
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                rounded-xl border border-border px-8 py-4 text-base font-medium text-slate-300
                hover:border-primary-500/60 hover:text-white transition-colors">
              Already have an account? Log in <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

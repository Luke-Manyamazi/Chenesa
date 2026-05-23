import Link from 'next/link'

const features = [
  { icon: '🚫', title: 'Spam & Phishing',        desc: 'Scams, fake invoices, lottery emails — gone instantly.' },
  { icon: '📢', title: 'Marketing & Newsletters', desc: 'Promotions, sales, "we miss you" emails — deleted.' },
  { icon: '🌐', title: 'Social Notifications',    desc: 'Facebook, LinkedIn, Twitter digests — cleared away.' },
  { icon: '📅', title: 'Old Read Emails',         desc: 'Emails you\'ve already read and don\'t need — removed.' },
]

const keeps = [
  '👤 Personal emails from real people',
  '💼 Work correspondence & meeting invites',
  '🧾 Receipts & order confirmations',
  '🏥 Medical & legal documents',
  '🔐 Security alerts & 2FA codes',
  '💰 Payslips & salary slips — always kept',
  '🏦 Bank statements & invoices',
  '✈️ Travel bookings & confirmations',
]

const providers = ['Gmail', 'Outlook', 'Yahoo', 'iCloud', 'AOL', 'Zoho', 'Any email']

const plans = [
  {
    name: 'Free Trial', price: '$0', highlight: false,
    features: ['3 free cleaning runs', 'Up to 50 emails per run', '1 email account', 'AI classification'],
    cta: 'Start free', href: '/signup',
  },
  {
    name: 'Basic', price: '$7', period: '/month', highlight: false,
    features: ['Unlimited cleaning runs', 'Up to 500 emails per run', '2 email accounts', 'Scheduled auto-cleaning', 'Full history'],
    cta: 'Coming soon', href: '#',
  },
  {
    name: 'Pro', price: '$15', period: '/month', highlight: true,
    features: ['Unlimited cleaning runs', 'Unlimited emails per run', '4 email accounts', 'Scheduled auto-cleaning', 'Full history', 'Priority support'],
    cta: 'Coming soon', href: '#',
  },
]

export default function LandingPage() {
  return (
    <div className="bg-background text-slate-100">

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:py-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary-800 bg-primary-900/30 px-4 py-1.5 text-sm text-primary-300 mb-8">
          ✨ Works with any email provider
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl text-balance">
          Your inbox,{' '}
          <span className="text-primary-400">automatically clean.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Chenesa connects to any email account and uses AI to delete spam, marketing emails, and old clutter — automatically, every day. You keep the important stuff. We handle the rest.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/signup" className="rounded-xl bg-primary-600 px-8 py-4 text-lg font-semibold text-white hover:bg-primary-500 transition-colors shadow-lg shadow-primary-900/50">
            Start free — no card needed
          </Link>
          <a href="#how" className="rounded-xl border border-border px-8 py-4 text-lg font-medium text-slate-300 hover:border-primary-500 transition-colors">
            See how it works
          </a>
        </div>
      </section>

      {/* Provider trust bar */}
      <section className="border-y border-border bg-surface/50 py-6">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm text-slate-500 mb-4">Works with any email provider</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {providers.map(p => (
              <span key={p} className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-slate-300">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-white mb-12">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: '1', title: 'Connect your email', desc: 'Sign in with Gmail or enter an App Password for any other provider. Setup takes 2 minutes.' },
            { step: '2', title: 'AI reads & classifies', desc: 'Chenesa reads the subject line and sender — never the email body. Claude AI classifies each email.' },
            { step: '3', title: 'Junk deleted, important kept', desc: 'Spam, marketing, and old emails are deleted. Personal, work, and financial emails are always kept.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="rounded-xl border border-border bg-surface p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/20 text-xl font-bold text-primary-400">{step}</div>
              <h3 className="mb-2 font-semibold text-white">{title}</h3>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What gets deleted / kept */}
      <section className="mx-auto max-w-6xl px-4 py-10 pb-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">What gets deleted</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(f => (
                <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">What&apos;s always kept</h2>
            <div className="rounded-xl border border-green-800/40 bg-green-900/10 p-6 space-y-3">
              {keeps.map(k => (
                <p key={k} className="text-sm text-slate-300">{k}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border bg-surface/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-white mb-4">Simple pricing</h2>
          <p className="text-center text-slate-400 mb-12">Start free. Upgrade when you&apos;re ready.</p>
          <div className="grid gap-6 sm:grid-cols-3">
            {plans.map(plan => (
              <div key={plan.name}
                className={`rounded-xl border p-6 flex flex-col ${plan.highlight ? 'border-primary-500 bg-primary-900/20 shadow-lg shadow-primary-900/30' : 'border-border bg-surface'}`}>
                {plan.highlight && (
                  <div className="mb-3 inline-block self-start rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">Most popular</div>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 mb-5">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  {plan.period && <span className="text-slate-400">{plan.period}</span>}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}
                  className={`rounded-lg py-2.5 text-center text-sm font-semibold transition-colors
                    ${plan.highlight ? 'bg-primary-600 hover:bg-primary-500 text-white' : 'border border-border hover:border-primary-500 text-slate-300'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to clean your inbox?</h2>
        <p className="text-slate-400 mb-8">3 free cleans. No credit card. Takes 2 minutes to set up.</p>
        <Link href="/signup" className="rounded-xl bg-primary-600 px-8 py-4 text-lg font-semibold text-white hover:bg-primary-500 transition-colors">
          Get started free
        </Link>
      </section>
    </div>
  )
}

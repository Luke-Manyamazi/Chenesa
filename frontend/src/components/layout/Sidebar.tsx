'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Mail, History, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'
import ThemeToggle from '@/components/ui/ThemeToggle'

const links = [
  { href: '/dashboard', label: 'Overview',  icon: LayoutDashboard },
  { href: '/accounts',  label: 'Accounts',  icon: Mail },
  { href: '/history',   label: 'History',   icon: History },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = (email[0] ?? '?').toUpperCase()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-surface">

      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <Logo size={30} />
        <span className="text-base font-bold text-white tracking-tight">Chenesa</span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Main
        </p>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-primary-600/15 text-primary-300 border border-primary-500/25 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                }`}
            >
              <Icon size={16} className={active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'} />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom: user + theme toggle + logout ── */}
      <div className="border-t border-border px-3 py-4 space-y-1">

        {/* User row — email on left, theme toggle on right */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initial}
          </div>
          {/* Email */}
          <p className="text-xs text-slate-400 truncate flex-1 leading-tight">{email}</p>
          {/* Theme toggle — fills the empty space */}
          <ThemeToggle />
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-red-950/30 hover:text-red-400 border border-transparent hover:border-red-900/40 transition-all duration-150"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

    </aside>
  )
}

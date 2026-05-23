'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Mail, History, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts',  label: 'Accounts',  icon: Mail },
  { href: '/history',   label: 'History',   icon: History },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
        <span className="text-xl">✉️</span>
        <span className="text-lg font-bold text-white">Chenesa</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${active ? 'bg-primary-600/20 text-primary-400' : 'text-slate-400 hover:bg-background hover:text-slate-200'}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <p className="px-3 py-1 text-xs text-slate-500 truncate">{email}</p>
        <button onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-background hover:text-slate-200 transition-colors">
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  )
}

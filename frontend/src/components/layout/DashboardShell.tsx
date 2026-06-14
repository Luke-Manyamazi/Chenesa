'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from '@/components/ui/Logo'

export default function DashboardShell({
  email,
  isAdmin = false,
  children,
}: {
  email: string
  isAdmin?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar email={email} isAdmin={isAdmin} />
      </div>

      {/* ── Mobile overlay sidebar ── */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Drawer — slides in from left */}
          <div className="relative z-10 flex-shrink-0 animate-in slide-in-from-left-full duration-200">
            <Sidebar email={email} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {/* ── Main column ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-bold text-white text-sm tracking-tight">Chenesa</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 min-w-0">
          {children}
        </main>

      </div>
    </div>
  )
}

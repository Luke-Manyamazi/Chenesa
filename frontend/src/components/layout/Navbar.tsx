import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function Navbar() {
  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-xl font-bold text-white tracking-tight">Chenesa</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2">
              Log in
            </Link>
            <Link href="/signup" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors">
              Recover storage free
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

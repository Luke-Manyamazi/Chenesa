import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <Logo size={32} />
        <span className="text-2xl font-bold text-white tracking-tight">Chenesa</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8">
        {children}
      </div>
    </div>
  )
}

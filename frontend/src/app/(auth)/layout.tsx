import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="text-3xl">✉️</span>
        <span className="text-2xl font-bold text-white">Chenesa</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        {children}
      </div>
    </div>
  )
}

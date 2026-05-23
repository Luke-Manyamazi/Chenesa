'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.refresh()          // sync session cookie to server
      router.push('/dashboard')
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
      <p className="text-sm text-slate-400 mb-6">Sign in to your Chenesa account</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" loading={loading} className="w-full justify-center">Sign in</Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        No account?{' '}
        <Link href="/signup" className="text-primary-400 hover:text-primary-300">Sign up free</Link>
      </p>
    </>
  )
}

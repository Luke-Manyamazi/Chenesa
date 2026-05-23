'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    setInfo('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      // Email confirmation is OFF — session returned immediately
      router.refresh()
      router.push('/dashboard')
    } else {
      // Email confirmation is ON — tell user to check email
      setInfo('Account created! Check your email and click the confirmation link, then sign in.')
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-sm text-slate-400 mb-6">3 free cleans — no credit card needed</p>

      <form onSubmit={handleSignup} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Password" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
        <Input label="Confirm password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        {info  && <p className="text-sm text-green-400 bg-green-900/20 rounded-lg px-3 py-2">{info}</p>}
        <Button type="submit" loading={loading} className="w-full justify-center">Create account</Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-400 hover:text-primary-300">Sign in</Link>
      </p>
    </>
  )
}

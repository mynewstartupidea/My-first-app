'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/get-app-url'
import { MessageCircle, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Mode = 'signin' | 'signup' | 'forgot'

function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState<Mode>('signin')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const router      = useRouter()
  const searchParams = useSearchParams()
  const supabase    = createClient()

  function reset() { setError(''); setSuccess(''); setPassword('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppUrl()}/auth/callback?next=/dashboard`,
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setSuccess('Password reset link sent! Check your email inbox.')
      return
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding` },
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setSuccess('Account created! Check your email to confirm your address, then sign in.')
      setMode('signin')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    const returnTo = searchParams.get('returnTo') ?? '/dashboard'
    router.push(returnTo)
    router.refresh()
  }

  const titles: Record<Mode, { h: string; sub: string; btn: string }> = {
    signin: { h: 'Welcome back',       sub: 'Sign in to your dashboard',     btn: 'Sign In'            },
    signup: { h: 'Create your account', sub: 'Start recovering revenue today', btn: 'Create Account'     },
    forgot: { h: 'Reset your password', sub: 'We\'ll email you a reset link', btn: 'Send reset link'    },
  }
  const { h, sub, btn } = titles[mode]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl mb-4 group-hover:scale-105 transition">
              <MessageCircle className="w-9 h-9 text-[#25D366]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Wapaci</h1>
          </Link>
          <p className="text-green-100 mt-1 text-sm">WhatsApp Automation for Ecommerce Brands</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {mode !== 'signin' && (
            <button
              onClick={() => { setMode('signin'); reset() }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          )}

          <h2 className="text-xl font-semibold text-slate-800 mb-1">{h}</h2>
          <p className="text-slate-500 text-sm mb-6">{sub}</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                placeholder="you@yourstore.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); reset() }}
                  className="text-xs text-[#25D366] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'forgot' ? 'Sending link…' : 'Please wait…'}</>
                : btn}
            </button>
          </form>

          {mode === 'signin' && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#25D366] font-medium hover:underline">
                Sign up free
              </Link>
            </p>
          )}
          {mode === 'signup' && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); reset() }} className="text-[#25D366] font-medium hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-green-200 text-xs mt-6">
          Powered by WhatsApp Business API · Built for ecommerce brands
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

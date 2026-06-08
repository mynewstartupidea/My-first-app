'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, Loader2, AlertCircle, MessageCircle, Lock, Mail } from 'lucide-react'
import { Suspense } from 'react'

function AdminLoginInner() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router   = useRouter()
  const supabase = createClient()

  // Sign out any existing session on mount to clear stale cross-subdomain cookies
  useEffect(() => {
    supabase.auth.signOut()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr || !data.user) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    // Verify admin access via server-side check
    const res = await fetch('/api/admin/users')
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      await supabase.auth.signOut()
      const detail = body?.debug
        ? `Logged in as: ${body.debug.logged_in_as} — expected: ${body.debug.expected}`
        : `Status ${res.status}`
      setError(`Access denied. ${detail}`)
      setLoading(false)
      return
    }

    router.replace('/admin')
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white font-bold text-2xl">Wapaci Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Restricted access — authorised personnel only</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@wapaci.com"
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          This is a private admin portal. Unauthorised access attempts are logged.
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    }>
      <AdminLoginInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
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
  // True the moment a hash-based token is spotted in the URL, so the plain
  // sign-in form never flashes first — without this, someone clicking
  // "Accept Invitation" would land here, see an ordinary login form asking
  // for a password they were never given, and reasonably conclude nothing
  // happened.
  const [completingInvite, setCompletingInvite] = useState(false)
  // Invite/recovery links authenticate once via a one-time token but never
  // set a password — without this step, an invited teammate would have no
  // way to log back in later (new device, expired session, cleared cookies).
  const [needsPassword, setNeedsPassword]   = useState(false)
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  // Forgot-password uses a typed-in code instead of a clickable link —
  // resetPasswordForEmail() goes through the browser's PKCE flow, which
  // stores its verification secret on whichever device/browser makes the
  // request, so a link opened anywhere else (a different browser, device,
  // or even just a different email app) silently fails. A code read off
  // the email and typed into this same page has no such dependency.
  const [otpSent, setOtpSent]               = useState(false)
  const [resetCode, setResetCode]           = useState('')
  const [resendingCode, setResendingCode]   = useState(false)
  const router      = useRouter()
  const searchParams = useSearchParams()
  const supabase    = useMemo(() => createClient(), [])
  const returnTo    = searchParams.get('returnTo')

  function safeReturnTo() {
    const target = returnTo ?? '/dashboard'
    return target.startsWith('/') ? target : '/dashboard'
  }

  function reset() { setError(''); setSuccess(''); setPassword('') }

  // Supabase's invite/magic-link/password-reset emails redirect here with the
  // session tokens embedded in the URL *hash* (#access_token=...), not a
  // ?code= query param — browsers never send the hash to a server, so
  // /auth/callback (which only handles ?code=) never even sees it. Only
  // client-side JS can read window.location.hash, which is why this has to
  // happen here rather than in a server route.
  useEffect(() => {
    // A recovery/invite link that's expired or already been used (e.g. an
    // email security scanner pre-visiting the link before the person clicks
    // it themselves, or an old email from a previous request) redirects back
    // here with `#error=access_denied&error_code=otp_expired...` instead of
    // `#access_token=...` — this used to only check for access_token, so that
    // case fell straight through to the plain sign-in form with zero
    // explanation, which just looked like the link did nothing at all.
    const hasToken = window.location.hash.includes('access_token')
    const hasError = window.location.hash.includes('error=')
    if (!hasToken && !hasError) return
    setCompletingInvite(true)

    async function completeHashSession() {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const access_token  = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      const type          = params.get('type') // 'invite' | 'recovery' | 'magiclink' | 'signup' | ...
      const hashError      = params.get('error_description') ?? params.get('error')

      // Strip the tokens out of the URL immediately regardless of outcome —
      // they're sensitive and shouldn't linger in browser history either way.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      if (hashError) {
        setCompletingInvite(false)
        setMode('forgot')
        setError(`This link has expired or was already used (it may have been opened once already by an email security scanner). Request a new one below.`)
        return
      }

      if (!access_token || !refresh_token) { setCompletingInvite(false); setError('Invalid or expired link.'); return }

      const { error: sessionErr } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sessionErr) { setCompletingInvite(false); setError('This link has expired or was already used.'); return }

      // Runs team-invite activation / store provisioning now that a real
      // session (and its cookies) exists — best-effort, a failure here
      // shouldn't strand someone who successfully authenticated.
      // isInviteAcceptance comes from Supabase's own hash type: a plain
      // password-reset link (type=recovery) must never risk activating a
      // stale pending invite for this same email from an unrelated org.
      await fetch('/api/auth/post-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isInviteAcceptance: type === 'invite' }),
      }).catch(() => {})

      // Invite and password-recovery links only ever authenticate via the
      // one-time token — neither sets a real password. Stop here and make
      // them set one instead of letting them straight into the app with no
      // way to sign back in later.
      if (type === 'invite' || type === 'recovery') {
        setCompletingInvite(false)
        setNeedsPassword(true)
        return
      }

      router.replace(safeReturnTo())
    }

    completeHashSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The PKCE (?code=) recovery path — resetPasswordForEmail() is called from
  // the browser client, which defaults to PKCE flow, so it's completed
  // server-side by /auth/callback (exchangeCodeForSession) rather than the
  // hash-parsing above. That route redirects here with ?needsPassword=1 once
  // the session is already established via cookies; this just needs to show
  // the same "set a new password" form the hash-based flow uses.
  useEffect(() => {
    if (searchParams.get('needsPassword') !== '1') return
    setNeedsPassword(true)
    window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!returnTo) return
    let cancelled = false

    async function continueIfSignedIn() {
      const { data } = await supabase.auth.getSession()
      let session = data.session

      if (!session) {
        const refreshed = await supabase.auth.refreshSession().catch(() => null)
        session = refreshed?.data.session ?? null
      }

      if (!cancelled && session) {
        router.replace(safeReturnTo())
      }
    }

    continueIfSignedIn()
    return () => {
      cancelled = true
    }
  }, [returnTo, router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppUrl()}/auth/callback?next=/dashboard&flow=recovery`,
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setOtpSent(true)
      return
    }

    if (mode === 'signup') {
      // Created server-side (admin API, email_confirm: true) rather than the
      // client-side supabase.auth.signUp() this used to call — same reasoning
      // as app/signup/page.tsx: that path depends on Supabase being able to
      // send a confirmation email, which isn't reliable here. No email step
      // means no "check your inbox" detour — sign straight in and go.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong creating your account. Please try again.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setSuccess('Account created — please sign in.')
        setMode('signin')
        return
      }
      window.location.href = '/onboarding'
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoading(false); setError(error.message); return }
    window.location.href = safeReturnTo()
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return }

    setSettingPassword(true)
    const { error: otpErr } = await supabase.auth.verifyOtp({ email, token: resetCode.trim(), type: 'recovery' })
    if (otpErr) {
      setSettingPassword(false)
      setError('Invalid or expired code. Double-check it, or resend below.')
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) {
      setSettingPassword(false)
      setError(updateErr.message)
      return
    }

    await fetch('/api/auth/post-login', { method: 'POST' }).catch(() => {})
    setSettingPassword(false)
    router.replace(safeReturnTo())
  }

  async function handleResendCode() {
    if (resendingCode) return
    setError('')
    setResendingCode(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/dashboard&flow=recovery`,
    })
    setResendingCode(false)
    if (error) { setError(error.message); return }
    setSuccess('New code sent — check your email.')
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords don\'t match.'); return }

    setSettingPassword(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    setSettingPassword(false)
    if (updateErr) { setError(updateErr.message); return }
    router.replace(safeReturnTo())
  }

  const titles: Record<Mode, { h: string; sub: string; btn: string }> = {
    signin: { h: 'Welcome back',       sub: 'Sign in to your dashboard',     btn: 'Sign In'            },
    signup: { h: 'Create your account', sub: 'Start recovering revenue today', btn: 'Create Account'     },
    forgot: { h: 'Reset your password', sub: 'We\'ll email you a code', btn: 'Send code'                 },
  }
  const { h, sub, btn } = titles[mode]

  if (completingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex flex-col items-center justify-center p-4 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-white text-sm font-medium">Setting up your account…</p>
      </div>
    )
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl mb-4">
              <MessageCircle className="w-9 h-9 text-[#25D366]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Wapaci</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-1">Set your password</h2>
            <p className="text-slate-500 text-sm mb-6">You're signed in — choose a password so you can log back in next time.</p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={settingPassword}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {settingPassword
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : 'Set password & continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

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
          <p className="text-green-100 mt-1 text-sm">Grow on WhatsApp.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {mode !== 'signin' && (
            <button
              onClick={() => { setMode('signin'); setOtpSent(false); setResetCode(''); reset() }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          )}

          <h2 className="text-xl font-semibold text-slate-800 mb-1">
            {mode === 'forgot' && otpSent ? 'Enter the code' : h}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'forgot' && otpSent ? <>We emailed a code to <span className="font-medium text-slate-700">{email}</span></> : sub}
          </p>

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

          {mode === 'forgot' && otpSent ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Code from your email</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base tracking-[0.3em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="00000000"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={settingPassword}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {settingPassword
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : 'Verify & set password'}
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendingCode}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition disabled:opacity-60"
              >
                {resendingCode ? 'Resending…' : "Didn't get a code? Resend"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
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
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
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
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'forgot' ? 'Sending code…' : 'Please wait…'}</>
                  : btn}
              </button>
            </form>
          )}

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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  MessageCircle, Loader2, AlertCircle, ArrowRight, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import CustomSelect from '@/components/custom-select'

const TEAM_SIZES = [
  { value: 'just_me',  label: 'Just me' },
  { value: '2_5',      label: '2–5 people' },
  { value: '6_20',     label: '6–20 people' },
  { value: '20_plus',  label: '20+ people' },
]

// Asked once, here, instead of as its own onboarding step — it just picks
// which sensible sidebar defaults (lib/sidebar-sections.ts's
// DEFAULT_SECTIONS_BY_BUSINESS_TYPE) get applied automatically when the
// store is provisioned. Not a feature gate, and fully changeable later from
// Settings, so getting it "wrong" here costs nothing.
const BUSINESS_TYPES = [
  { value: 'ecommerce' as const, label: 'Ecommerce store' },
  { value: 'lead_gen'  as const, label: 'Lead generation' },
]

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0)  return { label: '',        color: 'bg-slate-200',  width: 'w-0'   }
  if (pw.length < 6)    return { label: 'Too short', color: 'bg-red-400',   width: 'w-1/4' }
  const hasUpper  = /[A-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const score = [pw.length >= 10, hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (score <= 1) return { label: 'Weak',   color: 'bg-orange-400', width: 'w-2/4' }
  if (score <= 2) return { label: 'Medium', color: 'bg-yellow-400', width: 'w-3/4' }
  return               { label: 'Strong',  color: 'bg-green-500',  width: 'w-full' }
}

export default function SignupPage() {
  const [fullName, setFullName]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone]             = useState('')
  const [teamSize, setTeamSize]       = useState('')
  const [businessType, setBusinessType] = useState<'ecommerce' | 'lead_gen' | ''>('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  // Requiring a real code from their inbox (not just an account that exists)
  // is a deliberate anti-fake-signup gate — nobody gets into the platform on
  // an email they don't actually control. Typed code instead of only the
  // email's link: the link uses PKCE, which stores its verification secret
  // in whichever browser/device ran signUp(), so a confirmation link opened
  // on a different device/browser than the one used to sign up fails
  // outright with no recovery path.
  const [done, setDone]               = useState(false)
  const [otpCode, setOtpCode]         = useState('')
  const [verifying, setVerifying]     = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [resendMsg, setResendMsg]     = useState('')
  // True for the moment between "code verified" and "dashboard is actually
  // on screen" — a full-screen branded loading state instead of handing them
  // straight to whatever the dashboard looks like mid-fetch, so entering the
  // app reads as one continuous motion instead of a jarring handoff.
  const [enteringApp, setEnteringApp] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setVerifying(true)
    setVerifyError('')
    const { error: otpErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: otpCode.trim(), type: 'signup' })
    if (otpErr) {
      setVerifying(false)
      setVerifyError('Invalid or expired code. Double-check it, or resend below.')
      return
    }
    await fetch('/api/auth/post-login', { method: 'POST' }).catch(() => {})
    setVerifying(false)
    setEnteringApp(true)
    // window.location (not router.push) — a full navigation keeps this
    // loading screen on-screen for the entire handoff instead of it
    // disappearing the instant client-side routing starts, which is what
    // actually gives the "keep loading until the platform is ready" feel.
    window.location.href = '/dashboard'
  }

  async function handleResend() {
    setVerifying(true)
    setVerifyError('')
    setResendMsg('')
    const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    setVerifying(false)
    if (resendErr) { setVerifyError(resendErr.message); return }
    setResendMsg('New code sent — check your email.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessType) { setError('Please select what best describes your business.'); return }
    if (!teamSize) { setError('Please select your team size.'); return }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Enter a valid phone number with at least 10 digits.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')

    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name:     fullName.trim(),
          company_name:  companyName.trim(),
          phone:         phone.trim(),
          team_size:     teamSize,
          business_type: businessType,
        },
      },
    })

    if (authErr) {
      // Supabase's own error for an SMTP/email-provider failure ("Error
      // sending confirmation email") is a verbatim backend message, not
      // something a signing-up user can act on — show something they can,
      // and keep the raw message for every other case.
      setError(
        /sending confirmation email/i.test(authErr.message)
          ? "We couldn't send your confirmation email right now. Please try again in a few minutes, or contact support@wapaci.com if this keeps happening."
          : authErr.message
      )
      setLoading(false)
      return
    }

    // Best-effort — there's no session yet (email isn't confirmed), so this
    // upsert runs unauthenticated and may be blocked by RLS depending on
    // config. Not fatal: provisionStore() falls back to user_metadata for
    // the same fields once the code is verified and a real session exists.
    if (data.user) {
      await supabase.from('user_profiles').upsert({
        id:            data.user.id,
        full_name:     fullName.trim(),
        company_name:  companyName.trim(),
        phone:         phone.trim(),
        team_size:     teamSize,
        email:         email.trim(),
      }, { onConflict: 'id' })
    }

    setLoading(false)
    setDone(true)
  }

  if (enteringApp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex flex-col items-center justify-center p-4 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-white text-sm font-medium">Setting up your account…</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8 text-left">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3 text-center">Check your inbox!</h2>
            <p className="text-slate-500 text-sm mb-6 text-center">
              We emailed a code to <span className="font-semibold text-slate-800">{email}</span> — enter it below to finish setting up your account.
            </p>

            {verifyError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {verifyError}
              </div>
            )}
            {resendMsg && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {resendMsg}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Code from your email</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-base tracking-[0.3em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent transition"
                  placeholder="00000000"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & continue'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={verifying}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition disabled:opacity-60"
              >
                Didn&apos;t get a code? Resend
              </button>
            </form>

            <p className="text-slate-400 text-xs mt-6 text-center">
              The link in that email works too, as long as you open it on this same device/browser.
            </p>
            <div className="text-center mt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-[#25D366] font-medium hover:underline"
              >
                Back to sign in <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <p className="text-green-200 text-xs mt-5 text-center">Didn&apos;t get the email? Check spam or contact support@wapaci.com</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4 py-6 sm:py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-5 sm:mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-xl mb-2 sm:mb-3 group-hover:scale-105 transition">
              <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-[#25D366]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Wapaci</h1>
          </Link>
          <p className="text-green-100 mt-1 text-sm">Grow on WhatsApp.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Create your account</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Full name + Company — stacked below sm: at 2 columns on a
                narrow phone, each field had so little width left (page p-4 +
                card padding + gap, split in half) that placeholder text like
                "KidsCraft India" or "+91 98765 43210" visibly clipped
                mid-word instead of just being a bit snug. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Your name</label>
                <input
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Mehta"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Company / Store</label>
                <input
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="KidsCraft India"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
            </div>

            {/* What best describes your business — picks the sensible sidebar
                defaults for their account type automatically (fully
                changeable later from Settings), instead of asking as a
                separate step after signup. */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">What best describes your business?</label>
              <CustomSelect
                value={businessType}
                onChange={v => setBusinessType(v as 'ecommerce' | 'lead_gen')}
                options={BUSINESS_TYPES}
                placeholder="Select…"
                buttonClassName="text-sm"
              />
            </div>

            {/* Row 2: Phone + Team size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone number</label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Team size</label>
                <CustomSelect value={teamSize} onChange={setTeamSize} options={TEAM_SIZES} buttonClassName="text-sm" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Work email</label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rahul@kidscraftindia.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
              {password.length > 0 && (() => {
                const s = passwordStrength(password)
                return (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${s.color} ${s.width}`} />
                    </div>
                    <p className={`text-xs font-medium ${
                      s.label === 'Strong' ? 'text-green-600'
                      : s.label === 'Medium' ? 'text-yellow-600'
                      : 'text-red-500'
                    }`}>{s.label}</p>
                  </div>
                )
              })()}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Creating account…' : 'Create free account'}
            </button>

            <p className="text-center text-xs text-slate-400">
              By signing up you agree to our{' '}
              <Link href="/terms" className="text-[#25D366] hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-[#25D366] hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-[#25D366] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

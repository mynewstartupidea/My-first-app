'use client'

import { useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Landed here from app/api/shopify/callback/route.ts after a brand-new App
// Store merchant's account was created UNCONFIRMED — same anti-fake-signup
// gate as the direct /signup form: a Shopify OAuth install proves they're
// logged into a real Shopify admin, but not that the shop's on-file email is
// an inbox they currently control, so it still needs its own real code.
function ShopifyVerifyInner() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const email = searchParams.get('email') ?? ''
  const next  = searchParams.get('next') ?? '/dashboard'

  const [otpCode, setOtpCode]         = useState('')
  const [verifying, setVerifying]     = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [resendMsg, setResendMsg]     = useState('')
  const [enteringApp, setEnteringApp] = useState(false)

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setVerifying(true)
    setVerifyError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode.trim(), type: 'signup' })
    if (error) {
      setVerifying(false)
      setVerifyError('Invalid or expired code. Double-check it, or resend below.')
      return
    }
    await fetch('/api/auth/post-login', { method: 'POST' }).catch(() => {})
    setVerifying(false)
    setEnteringApp(true)
    window.location.href = next
  }

  async function handleResend() {
    setVerifying(true)
    setVerifyError('')
    setResendMsg('')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setVerifying(false)
    if (error) {
      // Same SMTP/email-provider failure case handled on /signup — this
      // resend hits the same email pathway, so a raw backend string
      // ("Error sending confirmation email") shouldn't reach the user here
      // either.
      setVerifyError(
        /error sending.*email/i.test(error.message)
          ? "We couldn't send the code right now. Please try again in a few minutes, or contact support@wapaci.com if this keeps happening."
          : error.message
      )
      return
    }
    setResendMsg('New code sent — check your email.')
  }

  if (enteringApp) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
        <p className="text-slate-600 text-sm font-medium">Setting up your account…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5 sm:p-8 text-left">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3 text-center">Check your inbox!</h1>
          <p className="text-slate-500 text-sm mb-6 text-center">
            Your Shopify store connected — we just need to confirm it&apos;s really you. We emailed a code to{' '}
            <span className="font-semibold text-slate-800">{email}</span> — enter it below to finish setting up your account.
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
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <>Verify &amp; continue <ArrowRight className="w-4 h-4" /></>}
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
        </div>
        <p className="text-slate-400 text-xs mt-5 text-center">Didn&apos;t get the email? Check spam or contact support@wapaci.com</p>
      </div>
    </main>
  )
}

export default function ShopifyVerifyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </main>
    }>
      <ShopifyVerifyInner />
    </Suspense>
  )
}

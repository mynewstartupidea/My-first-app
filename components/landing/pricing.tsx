'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, Loader2, Clock } from 'lucide-react'
import { getUtmParams } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/password-input'

const PRICE = 1999

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

type FormStep = 'form' | 'submitting' | 'checkout_pending' | 'saved_no_checkout'
  | 'set_password' | 'creating_account' | 'entering_app'

// Razorpay's checkout modal doesn't always restore scroll position on
// close/complete — without this, dismissing it can leave the page scrolled
// away from this section even though it already updated to show the right
// state, making it look like nothing happened. Small delay gives Razorpay's
// own close animation a moment to finish first.
function scrollToPricing() {
  setTimeout(() => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 150)
}

// Was a 4-tier $USD grid billed through Shopify's own billing API (hence
// "Billing handled securely by Shopify" below it) — Shopify billing only
// applies to Shopify-connected merchants, which doesn't cover the lead-gen
// side of the product, and the price was never actually payable from here
// anyway (every CTA just linked to /signup). Replaced with the same flat
// ₹1,999/month + Razorpay checkout flow already proven on two of the /lp/*
// landing pages (app/lp/ecommerce, app/lp/leads) — same backend
// (/api/landing/subscribe), just a new 'homepage' source/plan since this
// page serves both segments rather than one.
export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const [step, setStep]     = useState<FormStep>('form')
  const [name, setName]     = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone]   = useState('')
  const [email, setEmail]   = useState('')
  const [error, setError]   = useState('')
  const [razorpayReady, setRazorpayReady] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('submitting')

    // Previously no try/catch here at all — a network failure (offline, DNS,
    // CORS) or a non-JSON error response threw an unhandled exception,
    // leaving `step` stuck at 'submitting' forever: the button stayed
    // disabled with its spinner, no error shown, no way to retry without a
    // full page reload.
    let res: Response
    let data: {
      leadId?: string; subscriptionId?: string; keyId?: string
      prefill?: { name: string; email: string; contact: string }
      error?: string; message?: string
    }
    try {
      res = await fetch('/api/landing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, phone, email, source: 'homepage', ...getUtmParams() }),
      })
      data = await res.json()
    } catch {
      setError("Couldn't reach the server — check your connection and try again.")
      setStep('form')
      return
    }

    if (!res.ok) {
      setError(data.message ?? 'Something went wrong — please try again.')
      setStep('form')
      return
    }

    // Saved as soon as the request succeeds, not gated on completing
    // Razorpay checkout — same reasoning as the /lp/* pages this reuses.
    window.fbq?.('track', 'Lead')
    if (data.leadId) setLeadId(data.leadId)

    if (data.error === 'saved_no_checkout') {
      setStep('saved_no_checkout')
      return
    }

    if (!data.subscriptionId || !data.keyId || !razorpayReady || !window.Razorpay) {
      setStep('saved_no_checkout')
      return
    }

    const rzp = new window.Razorpay({
      key: data.keyId,
      subscription_id: data.subscriptionId,
      name: 'Wapaci',
      description: `Wapaci Plan — ₹${PRICE}/month`,
      prefill: data.prefill,
      theme: { color: '#25D366' },
      handler: () => { setStep('set_password'); scrollToPricing() },
      modal: { ondismiss: () => { setStep('checkout_pending'); scrollToPricing() } },
    })
    rzp.open()
    setStep('checkout_pending')
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (password.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setPwError("Passwords don't match."); return }
    setStep('creating_account')

    try {
      // The server verifies payment directly with Razorpay rather than
      // trusting anything client-supplied — right, but it means a brief
      // propagation gap between "checkout handler fired client-side" and
      // "Razorpay's own GET /subscriptions reflects that" would otherwise
      // show someone who genuinely just paid a confusing "not confirmed yet"
      // error. A couple of short, bounded retries absorbs that without
      // weakening the check itself — still asking Razorpay for real.
      let res!: Response
      let data!: { email?: string; error?: string }
      for (let attempt = 0; attempt < 3; attempt++) {
        res  = await fetch('/api/landing/complete-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, password }),
        })
        data = await res.json().catch(() => ({})) as { email?: string; error?: string }
        if (res.ok || res.status !== 402 || attempt === 2) break
        await new Promise(r => setTimeout(r, 1500))
      }

      if (!res.ok) {
        setPwError(data.error ?? 'Could not create your account — please try again.')
        setStep('set_password')
        return
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: data.email ?? email, password })
      if (signInErr) {
        setPwError('Your account was created, but automatic sign-in failed — please log in manually.')
        setStep('set_password')
        return
      }

      await fetch('/api/auth/post-login', { method: 'POST' }).catch(() => {})
      setStep('entering_app')
      // Full navigation (not router.push) keeps this branded loading state on
      // screen for the entire handoff — same reasoning as app/signup/page.tsx's
      // identical enteringApp screen.
      window.location.href = '/dashboard'
    } catch {
      setPwError("Couldn't reach the server — check your connection and try again.")
      setStep('set_password')
    }
  }

  return (
    <section id="pricing" ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onLoad={() => setRazorpayReady(true)} />
      <div className="max-w-md mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Pricing</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            No setup fees · Cancel anytime
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white/[0.03] border border-white/10 rounded-3xl p-8"
        >
          {step === 'entering_app' ? (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#25D366] mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">Setting up your account…</h3>
              <p className="text-slate-400 text-sm">This only takes a moment.</p>
            </div>
          ) : step === 'set_password' || step === 'creating_account' ? (
            <>
              <div className="text-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#25D366] mx-auto mb-3" />
                <h3 className="text-white font-bold text-xl mb-1">Payment received!</h3>
                <p className="text-slate-400 text-sm">Create a password to access your dashboard — <span className="text-slate-300">{email}</span></p>
              </div>
              <form onSubmit={handleCreateAccount} className="space-y-3">
                <PasswordInput required autoFocus autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <PasswordInput required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
                <button type="submit" disabled={step === 'creating_account'}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98]">
                  {step === 'creating_account' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account &amp; continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          ) : step === 'saved_no_checkout' || step === 'checkout_pending' ? (
            <div className="text-center py-6">
              <Clock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">We&apos;ve saved your details</h3>
              <p className="text-slate-400 text-sm">
                {step === 'checkout_pending'
                  ? "Didn't finish payment? No problem — our team will call you shortly to complete your subscription."
                  : "Our team will reach out shortly to complete your subscription."}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h3 className="text-white font-extrabold text-3xl mb-1">
                  ₹{PRICE.toLocaleString('en-IN')}<span className="text-slate-400 text-base font-medium">/month</span>
                </h3>
                <p className="text-slate-500 text-xs">Cancel anytime, no long-term contract</p>
              </div>

              <ul className="space-y-2 mb-6">
                {['WhatsApp automation', 'Abandoned cart recovery & reminders', 'Unlimited broadcasts & campaigns'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366] flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company / Store"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />

                {error && (
                  <p className="text-red-400 text-xs">
                    {error}
                    {error.startsWith('An account with this email') && (
                      <> <Link href="/login" className="underline font-semibold">Log in →</Link></>
                    )}
                  </p>
                )}

                <button type="submit" disabled={step === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98]">
                  {step === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get Started <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-slate-600 text-[11px] text-center mt-4">Secure payment via Razorpay. Billed every 30 days.</p>
            </>
          )}
        </motion.div>
      </div>
    </section>
  )
}

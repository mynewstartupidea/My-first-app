'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, Loader2, PhoneCall } from 'lucide-react'
import { getUtmParams, getFacebookCookies } from '@/lib/utils'

type FormStep = 'form' | 'submitting' | 'success'

// No price, no Razorpay, no account creation — every submission here is
// just a lead for a human to call and close manually, not a self-serve
// purchase. (Self-serve signup/payment still exists separately at /signup,
// untouched by this.) Was a flat ₹1,999/month + Razorpay checkout + create-
// password-on-payment flow; removed entirely per instruction to show no
// price anywhere on the marketing site and just collect contact info.
export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const [step, setStep] = useState<FormStep>('form')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('submitting')

    const fbEventId = crypto.randomUUID()
    const { fbp, fbc } = getFacebookCookies()
    let res: Response
    let data: { leadId?: string; error?: string; message?: string }
    try {
      res = await fetch('/api/landing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, phone, email, source: 'homepage', ...getUtmParams(), fbp, fbc, fbEventId }),
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

    window.fbq?.('track', 'Lead', {}, { eventID: fbEventId })
    setStep('success')
  }

  return (
    <section id="pricing" ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <div className="max-w-md mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Get Started</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Tell us about your business
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            Share a few details and our team will call you to set things up.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white/[0.03] border border-white/10 rounded-3xl p-8"
        >
          {step === 'success' ? (
            <div className="text-center py-6">
              <PhoneCall className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">Thanks — we've got your details</h3>
              <p className="text-slate-400 text-sm">Our team will call you shortly to get you set up.</p>
            </div>
          ) : (
            <>
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
              <p className="text-slate-600 text-[11px] text-center mt-4">No payment required — our team will call you to set things up.</p>
            </>
          )}
        </motion.div>
      </div>
    </section>
  )
}

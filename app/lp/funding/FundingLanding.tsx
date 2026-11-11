'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, Loader2, ShieldCheck, Clock, Lock,
} from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import { cn, getUtmParams, getFacebookCookies, isValidWebsiteInput } from '@/lib/utils'
import { FUNDING_QUESTIONS, FUNDING_DESCRIPTION_QUESTION, FUNDING_DESCRIPTION_MAX_LEN } from '@/lib/funding-lead-questions'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center px-5 py-4 bg-[#030812]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/logo-square.svg" alt="Wapaci" className="w-8 h-8 rounded-xl shadow-lg shadow-green-500/20" />
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
    </header>
  )
}

// 'contact' and 'description' bookend the 8 multiple-choice questions — one
// flat list of screen ids drives both the progress bar and the step switch
// below, so adding/removing a question never needs touching the stepper math.
const TRUST_ITEMS = [
  { Icon: Clock, label: '2 minutes' },
  { Icon: Lock, label: 'Confidential' },
  { Icon: ShieldCheck, label: 'No obligation' },
]

const SCREENS = ['contact', ...FUNDING_QUESTIONS.map(q => q.key), 'description'] as const
type Screen = typeof SCREENS[number]
type Status = 'filling' | 'submitting' | 'success' | 'error'

interface ContactFields {
  name: string; phone: string; email: string; companyName: string; website: string
}

export default function FundingLanding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState<Status>('filling')
  const [errorMsg, setErrorMsg] = useState('')
  const [contact, setContact] = useState<ContactFields>({ name: '', phone: '', email: '', companyName: '', website: '' })
  const [contactErrors, setContactErrors] = useState<Partial<ContactFields>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [descError, setDescError] = useState('')

  const screen: Screen = SCREENS[stepIndex]
  const totalScreens = SCREENS.length
  const progressPct = Math.round(((stepIndex + 1) / totalScreens) * 100)

  function goNext() { setStepIndex(i => Math.min(i + 1, totalScreens - 1)) }
  function goBack() { setStepIndex(i => Math.max(i - 1, 0)) }

  function validateContact(): boolean {
    const errs: Partial<ContactFields> = {}
    if (!contact.name.trim()) errs.name = 'Please enter your name.'
    if (!contact.phone.trim()) errs.phone = 'Please enter a phone number.'
    if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errs.email = 'Please enter a valid email address.'
    if (!contact.companyName.trim()) errs.companyName = 'Please enter your startup name.'
    if (contact.website.trim() && !isValidWebsiteInput(contact.website)) errs.website = "That doesn't look like a website."
    setContactErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleContactContinue(e: React.FormEvent) {
    e.preventDefault()
    if (validateContact()) goNext()
  }

  // Multiple-choice screens auto-advance on selection (one tap, like a real
  // Meta Instant Form) instead of making people also hit a separate "Next".
  function selectAnswer(key: string, option: string) {
    setAnswers(prev => ({ ...prev, [key]: option }))
    setTimeout(goNext, 250)
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDescError('')
    const trimmedDesc = description.trim()
    if (!trimmedDesc) { setDescError('Please briefly describe your startup.'); return }
    if (trimmedDesc.length > FUNDING_DESCRIPTION_MAX_LEN) { setDescError('Please keep this a bit shorter.'); return }

    setStatus('submitting')
    setErrorMsg('')
    const fbEventId = crypto.randomUUID()
    const { fbp, fbc } = getFacebookCookies()
    try {
      const res = await fetch('/api/landing/funding-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.name, phone: contact.phone, email: contact.email,
          companyName: contact.companyName, website: contact.website,
          answers, description: trimmedDesc,
          ...getUtmParams(), fbp, fbc, fbEventId,
        }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message ?? 'Something went wrong — please try again.')
        setStatus('error')
        return
      }
      window.fbq?.('track', 'Lead', {}, { eventID: fbEventId })
      setStatus('success')
    } catch {
      setErrorMsg("Couldn't reach the server — check your connection and try again.")
      setStatus('error')
    }
  }

  const currentQuestion = FUNDING_QUESTIONS.find(q => q.key === screen)

  return (
    <div className="relative bg-[#030812] min-h-screen overflow-x-hidden">
      <AuroraBg />
      <Header />

      <section className="relative pt-28 pb-16 px-5 min-h-screen flex items-center">
        <div className="max-w-xl mx-auto w-full">
          {status !== 'success' && (
            <div className="text-center mb-8">
              <p className="text-[#25D366] text-xs font-bold tracking-widest uppercase mb-2">Startup Funding</p>
              <h1 className="font-extrabold leading-tight tracking-tight text-3xl md:text-4xl text-white mb-3">
                Raise funding for your startup
              </h1>
              <p className="text-slate-400 text-base max-w-md mx-auto">
                Answer a few quick questions — our team will review and reach out to discuss next steps.
              </p>
              <div className="flex flex-wrap justify-center gap-5 mt-5">
                {TRUST_ITEMS.map(({ Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <Icon className="w-3.5 h-3.5 text-[#25D366]" />{label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-7 sm:p-8">
            {status === 'success' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
                <h3 className="text-white font-bold text-xl mb-2">Thanks — you're all set!</h3>
                <p className="text-slate-400 text-sm">
                  We've received your details. Our team will review your application and reach out within 1–2 business days.
                </p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-xs font-medium">Step {stepIndex + 1} of {totalScreens}</span>
                    {stepIndex > 0 && (
                      <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition">
                        <ArrowLeft className="w-3 h-3" /> Back
                      </button>
                    )}
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-[#25D366] rounded-full" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={screen} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>

                    {screen === 'contact' && (
                      <form onSubmit={handleContactContinue} className="space-y-3">
                        <h2 className="text-white font-bold text-lg mb-1">Let's start with the basics</h2>
                        <div>
                          <input value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} placeholder="Full name"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                          {contactErrors.name && <p className="text-red-400 text-xs mt-1.5">{contactErrors.name}</p>}
                        </div>
                        <div>
                          <input type="tel" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="Phone number"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                          {contactErrors.phone && <p className="text-red-400 text-xs mt-1.5">{contactErrors.phone}</p>}
                        </div>
                        <div>
                          <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="Email address"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                          {contactErrors.email && <p className="text-red-400 text-xs mt-1.5">{contactErrors.email}</p>}
                        </div>
                        <div>
                          <input value={contact.companyName} onChange={e => setContact(c => ({ ...c, companyName: e.target.value }))} placeholder="Company / Startup name"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                          {contactErrors.companyName && <p className="text-red-400 text-xs mt-1.5">{contactErrors.companyName}</p>}
                        </div>
                        <div>
                          <input value={contact.website} onChange={e => setContact(c => ({ ...c, website: e.target.value }))} placeholder="Company website (if available)"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                          {contactErrors.website && <p className="text-red-400 text-xs mt-1.5">{contactErrors.website}</p>}
                        </div>
                        <button type="submit"
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98]">
                          Continue <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    )}

                    {currentQuestion && (
                      <div>
                        <h2 className="text-white font-bold text-lg mb-4">{currentQuestion.question}</h2>
                        <div className="space-y-2">
                          {currentQuestion.options.map(option => {
                            const selected = answers[currentQuestion.key] === option
                            return (
                              <button key={option} type="button" onClick={() => selectAnswer(currentQuestion.key, option)}
                                className={cn(
                                  'w-full flex items-center justify-between gap-3 text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition',
                                  selected ? 'bg-[#25D366]/15 border-[#25D366]/50 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/[0.07]',
                                )}>
                                {option}
                                {selected && <Check className="w-4 h-4 text-[#25D366] flex-shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {screen === 'description' && (
                      <form onSubmit={handleFinalSubmit} className="space-y-3">
                        <h2 className="text-white font-bold text-lg mb-1">{FUNDING_DESCRIPTION_QUESTION}</h2>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} maxLength={FUNDING_DESCRIPTION_MAX_LEN}
                          placeholder="Tell us what your startup does and the problem it solves…"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 resize-none" />
                        {descError && <p className="text-red-400 text-xs">{descError}</p>}
                        {status === 'error' && errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
                        <button type="submit" disabled={status === 'submitting'}
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98]">
                          {status === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit application <ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </form>
                    )}

                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/8 py-8 px-5 text-center">
        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
      </footer>
    </div>
  )
}

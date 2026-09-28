'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import {
  MessageCircle, ArrowRight, CheckCircle2, Zap, Users, Calendar,
  Clock, Star, Check, Loader2, Inbox,
} from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import ScrollProgress from '@/components/landing/scroll-progress'

const PRICE = 1999

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-[#030812]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-105 transition">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
      <a href="#get-started" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-green-500/30 hover:scale-[1.03] active:scale-[0.98]">
        Get started <ArrowRight className="w-4 h-4" />
      </a>
    </header>
  )
}

const chat = [
  { type: 'bot' as const,  text: "Hi! We've received your enquiry 🙌 Our team will call you shortly. Feel free to message us here if you have any questions in the meantime.", time: '2:14 PM', auto: true },
  { type: 'lead' as const, text: 'Great, thank you! Quick question — do you have any offers running right now?', time: '2:16 PM' },
  { type: 'bot' as const,  text: 'Yes! I\'ll share the details right now — one sec.', time: '2:16 PM' },
]

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="hero-grid" />
      <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">For business owners who run on leads</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="font-extrabold leading-[1.1] tracking-tight text-4xl md:text-5xl lg:text-[3.2rem] text-white mb-6">
            The moment a lead comes in, <span className="text-[#25D366]">a WhatsApp message goes out.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="text-slate-400 text-lg leading-relaxed max-w-lg mb-8">
            The moment a lead comes in, Wapaci messages them on WhatsApp automatically — before your competitor even sees it.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-3 mb-8">
            <a href="#get-started" className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
              Get started — ₹1,999/mo <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }} className="flex flex-wrap gap-5">
            {['₹1,999/month', 'Official WhatsApp API', '10-minute setup'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-slate-500 text-sm">
                <Check className="w-3.5 h-3.5 text-[#25D366]" />{t}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="relative flex justify-center lg:justify-end">
          <div className="w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">Your Business</p>
                <p className="text-white/70 text-[10px] mt-0.5">online</p>
              </div>
            </div>
            <div className="p-4 space-y-3 bg-[#0b141a] min-h-[280px]">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" /> New lead from Facebook Ads
              </motion.div>
              {chat.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.35 }}
                  className={`flex ${m.type === 'lead' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.type === 'lead' ? 'bg-[#1f2c33] text-slate-100' : 'bg-[#005c4b] text-white'}`}>
                    <p className="text-[13px] leading-snug">{m.text}</p>
                    <p className="text-[10px] text-white/50 mt-1 text-right">
                      {m.type === 'bot' && 'auto' in m && m.auto ? 'Sent automatically · ' : ''}{m.time}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1, duration: 0.5 }}
            className="absolute -left-4 -bottom-4 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm">
            <p className="text-[11px] text-slate-400">First message sent</p>
            <p className="text-[#25D366] font-bold text-sm">automatically, in seconds ⚡</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

const FEATURES = [
  { icon: Zap,      title: 'Messages first',   desc: 'Sent the instant a lead comes in.' },
  { icon: Inbox,    title: 'One inbox',        desc: 'Every lead, every source, one place.' },
  { icon: Calendar, title: 'Never forget',     desc: 'Follow-ups surface exactly when due.' },
  { icon: Users,    title: 'Built for teams',  desc: 'Assign, call, log — no spreadsheets.' },
]

function Features() {
  return (
    <section className="relative py-20 px-5">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white text-center mb-12">Everything you need to stop losing leads</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-[#25D366]/30 hover:bg-white/[0.05] transition-colors">
              <div className="w-11 h-11 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-[#25D366]" />
              </div>
              <h3 className="text-white font-bold mb-1.5">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const TESTIMONIALS = [
  { name: 'Aman Kapoor', role: 'Founder', company: 'Kapoor Interiors', quote: 'We message first now, not the other way round.' },
  { name: 'Sana Iqbal',  role: 'Real Estate Agent', company: 'Iqbal Properties', quote: 'No more "I meant to call them back."' },
  { name: 'Rohan Verma', role: 'Owner', company: 'Verma Fitness Studio', quote: 'Paid for itself with the first lead it saved.' },
]

function Testimonials() {
  return (
    <section className="relative py-20 px-5">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white text-center mb-2">Built for businesses like yours</h2>
        <p className="text-center text-slate-600 text-[11px] mb-10 uppercase tracking-widest font-semibold">Illustrative examples</p>
        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 flex flex-col">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[#25D366] text-xs font-bold flex-shrink-0">
                  {t.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-slate-500 text-xs truncate">{t.role} · {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

type FormStep = 'form' | 'submitting' | 'checkout_pending' | 'saved_no_checkout' | 'paid'

function GetStarted() {
  const [step, setStep] = useState<FormStep>('form')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [razorpayReady, setRazorpayReady] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('submitting')

    const res = await fetch('/api/landing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, phone, email, source: 'lp_leads' }),
    })
    const data = await res.json() as {
      leadId?: string; subscriptionId?: string; keyId?: string
      prefill?: { name: string; email: string; contact: string }
      error?: string; message?: string
    }

    if (!res.ok) {
      setError(data.message ?? 'Something went wrong — please try again.')
      setStep('form')
      return
    }

    if (data.error === 'saved_no_checkout') {
      setStep('saved_no_checkout')
      return
    }

    if (!data.subscriptionId || !data.keyId || !razorpayReady || !window.Razorpay) {
      // Details are already saved server-side at this point even though
      // checkout couldn't open — same safe fallback as a Razorpay-side failure.
      setStep('saved_no_checkout')
      return
    }

    const rzp = new window.Razorpay({
      key: data.keyId,
      subscription_id: data.subscriptionId,
      name: 'Wapaci',
      description: 'Lead Response Plan — ₹1,999/month',
      prefill: data.prefill,
      theme: { color: '#25D366' },
      handler: () => setStep('paid'),
      modal: { ondismiss: () => setStep('checkout_pending') },
    })
    rzp.open()
    setStep('checkout_pending')
  }

  return (
    <section id="get-started" className="relative py-24 px-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onLoad={() => setRazorpayReady(true)} />
      <div className="max-w-md mx-auto">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8">

          {step === 'paid' ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">You&apos;re all set!</h3>
              <p className="text-slate-400 text-sm">Our team will reach out shortly to get you fully set up.</p>
            </div>
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
                <p className="text-[#25D366] text-xs font-bold tracking-widest uppercase mb-2">Get started</p>
                <h3 className="text-white font-extrabold text-2xl mb-1">₹{PRICE.toLocaleString('en-IN')}<span className="text-slate-400 text-base font-medium">/month</span></h3>
                <p className="text-slate-500 text-xs">Cancel anytime, no long-term contract</p>
              </div>

              <ul className="space-y-2 mb-6">
                {['Instant WhatsApp auto-reply', 'Unlimited leads & follow-ups', 'Team & call log tools'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-[#25D366] flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Business name"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40" />

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button type="submit" disabled={step === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98]">
                  {step === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Subscribe now <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-slate-600 text-[11px] text-center mt-4">Secure payment via Razorpay. Billed every 30 days.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default function LeadsLanding() {
  return (
    <div className="relative bg-[#030812] min-h-screen overflow-x-hidden">
      <AuroraBg />
      <ScrollProgress />
      <Header />
      <Hero />
      <Features />
      <Testimonials />
      <GetStarted />
      <footer className="relative border-t border-white/8 py-8 px-5 text-center">
        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
      </footer>
    </div>
  )
}

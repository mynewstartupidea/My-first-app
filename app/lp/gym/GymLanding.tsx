'use client'

import { motion, useInView, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, ArrowRight, CheckCircle2, Zap, RefreshCw, Bell, BarChart3, CreditCard, Star, TrendingUp, Check, X } from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import ScrollProgress from '@/components/landing/scroll-progress'

const UTM = '/signup?utm_source=facebook&utm_campaign=gym-lp'

function useCountUp(target: number, inView: boolean, duration = 1.8) {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let t0: number | null = null
    const tick = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / (duration * 1000), 1)
      setVal((1 - Math.pow(1 - p, 3)) * target)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target, duration])
  return val
}

function TiltCard({ children, glow, border }: { children: React.ReactNode; glow: string; border: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0); const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 260, damping: 24 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 260, damping: 24 })
  const glowX = useTransform(mx, [-0.5, 0.5], [0, 100])
  const glowY = useTransform(my, [-0.5, 0.5], [0, 100])
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5)
  }
  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0) }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800, borderColor: border, borderWidth: 1, borderStyle: 'solid' }}
      whileHover={{ scale: 1.03 }} transition={{ scale: { type: 'spring', stiffness: 300, damping: 22 } }}
      className="relative rounded-2xl bg-[#080f1a] overflow-hidden cursor-default group">
      <motion.div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glow} 0%, transparent 55%)` }} />
      <div style={{ transform: 'translateZ(20px)' }} className="relative p-6 h-full">{children}</div>
    </motion.div>
  )
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-[#030812]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-105 transition"><MessageCircle className="w-4 h-4 text-white" /></div>
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
      <Link href={UTM} className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-green-500/30 hover:scale-[1.03] active:scale-[0.98]">
        Start free trial <ArrowRight className="w-4 h-4" />
      </Link>
    </header>
  )
}

const heroLines = [
  { text: '300 members', color: 'text-white' },
  { text: 'joined this year.', color: 'text-white' },
  { text: '90 have already', color: 'text-white' },
  { text: 'stopped coming.', color: 'text-red-400' },
]

const chat = [
  { type: 'bot' as const, text: '💪 Hey Ananya! Your FitLife membership expires in 5 days.', time: '9:00 AM' },
  { type: 'bot' as const, text: 'Renew now → get 2 months for the price of 1! Offer valid 48 hrs only 🔥', time: '9:00 AM' },
  { type: 'user' as const, text: 'Renewing right now, thanks for reminding me!', time: '9:04 AM' },
  { type: 'bot' as const, text: '🎉 Renewed! See you at 6 AM tomorrow. Free PT session booked for Monday 💪', time: '9:04 AM' },
]

function Hero() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60])
  return (
    <section ref={ref} className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="hero-grid" />
      <motion.div style={{ y: contentY }} className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">WhatsApp for Gyms & Fitness Centres</span>
          </motion.div>
          <h1 className="font-extrabold leading-[1.1] tracking-tight mb-6">
            {heroLines.map((line, i) => (
              <motion.div key={line.text} initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.1 * i }}
                className={`block text-4xl md:text-5xl lg:text-[3.2rem] ${line.color}`}>{line.text}</motion.div>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="text-slate-400 text-lg leading-relaxed max-w-lg mb-8">
            Silent churn is the #1 killer of gym revenue. Members don't cancel — they just stop coming. Wapaci catches them before they're gone with a WhatsApp message at exactly the right moment.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }} className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link href={UTM} className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
              Stop losing members — free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.8 }} className="flex flex-wrap gap-5">
            {['No credit card required', 'Setup in 10 minutes', 'Official WhatsApp Business API'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-slate-500 text-sm"><Check className="w-3.5 h-3.5 text-[#25D366]" />{t}</span>
            ))}
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center lg:justify-end">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.4, duration: 0.5 }}
            className="absolute -left-4 top-10 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm">
            <p className="text-[11px] text-slate-400">Membership renewed</p>
            <p className="text-white font-bold text-sm">Ananya · 6-month plan</p>
            <p className="text-[#25D366] text-[11px] font-semibold mt-0.5">4 min after reminder ✓</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.0, duration: 0.5 }}
            className="absolute -right-2 bottom-20 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm text-center">
            <p className="text-3xl font-extrabold text-[#25D366]">30%</p>
            <p className="text-[11px] text-slate-400">of members churn<br />without a nudge</p>
          </motion.div>
          <div className="relative w-[290px] bg-[#0a0f1a] rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0a0f1a] rounded-b-xl z-10" />
            <div className="bg-[#075E54] px-4 pt-8 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
              <div><p className="text-white font-semibold text-sm">FitLife Gym Bot</p><p className="text-green-200 text-[11px]">Online · replies instantly</p></div>
            </div>
            <div className="bg-[#0d1117] px-3 py-4 space-y-2.5 min-h-[310px]">
              {chat.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ duration: 0.35, delay: 0.9 + i * 0.3 }} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.type === 'user' ? 'bg-[#25D366] text-white rounded-br-sm' : 'bg-[#1a2533] text-slate-200 rounded-bl-sm'}`}>
                    <p>{msg.text}</p>
                    <p className={`text-[10px] mt-0.5 text-right ${msg.type === 'user' ? 'text-green-100' : 'text-slate-500'}`}>{msg.time}{msg.type === 'user' && ' ✓✓'}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="bg-[#0d1117] px-3 pb-8 pt-2 flex items-center gap-2 border-t border-white/5">
              <div className="flex-1 bg-[#1a2533] rounded-full px-3 py-2 text-slate-600 text-xs">Reply to member...</div>
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0"><ArrowRight className="w-3.5 h-3.5 text-white" /></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

const statsConfig = [
  { target: 30, suffix: '%', prefix: '', decimals: 0, label: 'Avg annual member churn' },
  { target: 80, suffix: '%', prefix: '', decimals: 0, label: 'Renewals recovered with reminders' },
  { target: 98, suffix: '%', prefix: '', decimals: 0, label: 'WhatsApp open rate' },
  { target: 2, suffix: 'x', prefix: '', decimals: 0, label: 'Trial-to-member conversion' },
]

function StatsBar() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const vals = [useCountUp(statsConfig[0].target, inView), useCountUp(statsConfig[1].target, inView), useCountUp(statsConfig[2].target, inView), useCountUp(statsConfig[3].target, inView)]
  return (
    <section ref={ref} className="bg-[#030812] border-y border-white/5 py-10">
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-6">
        {statsConfig.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, delay: 0.1 * i }} className="text-center">
            <p className="text-2xl md:text-3xl font-extrabold text-white tabular-nums">{s.prefix}{vals[i].toFixed(s.decimals)}{s.suffix}</p>
            <p className="text-slate-500 text-sm mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function ProblemSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The problem</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Members don't quit. They just<br />stop coming — and you never know why.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">They miss one week. Then two. Then their membership quietly expires. You lost ₹3,000/month and didn't even get to fight for it. Wapaci fights for it.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">😶</span><span className="text-red-400 font-bold">Without Wapaci</span></div>
            <div className="space-y-3.5">
              {[
                { label: 'Member misses a week', value: 'You don\'t know' },
                { label: 'Membership expiry', value: 'You call, they ignore' },
                { label: 'Member goes cold', value: 'Lost forever, silently' },
                { label: 'Trial conversion', value: 'Hit or miss' },
                { label: 'New batch announcement', value: 'WhatsApp group chaos' },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 text-sm shrink-0">{row.label}</span>
                  <span className="text-red-400 font-semibold text-sm flex items-center gap-1.5"><X className="w-3.5 h-3.5 shrink-0" />{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="bg-[#25D366]/5 border border-[#25D366]/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">💬</span><span className="text-[#25D366] font-bold">With Wapaci</span></div>
            <div className="space-y-3.5">
              {[
                { label: 'Member misses a week', value: 'Auto "we miss you" message sent' },
                { label: 'Membership expiry', value: 'Reminder at 7, 3, 1 day before' },
                { label: 'Member goes cold', value: 'Win-back offer at 30/60 days' },
                { label: 'Trial conversion', value: 'Follow-up sequence, automated' },
                { label: 'New batch announcement', value: 'One broadcast, all members notified' },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 text-sm shrink-0">{row.label}</span>
                  <span className="text-[#25D366] font-semibold text-sm flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const features = [
  { icon: Bell, title: 'Membership Renewal Reminders', desc: 'Automated WhatsApp alerts at 7, 3, and 1 day before expiry. Members renew without you lifting the phone.', accent: '#25D366', glow: 'rgba(37,211,102,0.15)', border: 'rgba(37,211,102,0.25)', stat: '80% renewal recovery rate' },
  { icon: Zap, title: 'Trial-to-Paid Conversion', desc: 'Free trial ends? Wapaci sends a follow-up sequence with an offer that converts. Same leads, far better results.', accent: '#f97316', glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.2)', stat: '2x conversion rate' },
  { icon: RefreshCw, title: 'Win-back Campaigns', desc: 'Members gone cold at 30, 60, or 90 days get a personalised offer. The ones you thought you\'d lost come back.', accent: '#a855f7', glow: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.2)', stat: '35% lapsed members return' },
  { icon: BarChart3, title: 'Batch & Class Broadcasts', desc: 'New batch starting? New trainer? New timing? Broadcast to all members in one click with 98% open rate.', accent: '#3b82f6', glow: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.2)', stat: '5x vs WhatsApp groups' },
  { icon: CreditCard, title: 'Fee Collection Reminders', desc: 'Automated, friendly reminders that bring in monthly fees without the awkward phone calls. Members appreciate it too.', accent: '#ec4899', glow: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.2)', stat: '90% on-time collection' },
  { icon: Star, title: 'Member Engagement', desc: 'Daily workout tips, motivational messages, and challenges keep members engaged between visits — and reduce churn.', accent: '#eab308', glow: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.2)', stat: '40% less silent churn' },
]

function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What Wapaci does</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Every tool you need to<br />retain members and grow revenue.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">Set it up once. Wapaci handles renewals, win-backs, and announcements so you can focus on running your gym.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 50, filter: 'blur(8px)' }} animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}} transition={{ duration: 0.55, delay: 0.07 * i, ease: [0.16, 1, 0.3, 1] }}>
              <TiltCard glow={f.glow} border={f.border}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.accent}20`, border: `1px solid ${f.accent}40` }}><f.icon className="w-5 h-5" style={{ color: f.accent }} /></div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                <div className="mt-5 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit" style={{ color: f.accent, background: `${f.accent}15` }}>{f.stat}</div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TheMath() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-4xl mx-auto px-5 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The math</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">How much silent churn is<br />costing your gym right now?</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-6 text-center mb-8">
            <div><p className="text-slate-500 text-sm mb-2">Avg annual membership churn</p><p className="text-4xl font-extrabold text-red-400">30%</p><p className="text-slate-600 text-xs mt-1">industry average</p></div>
            <div><p className="text-slate-500 text-sm mb-2">Renewal recovery with Wapaci</p><p className="text-4xl font-extrabold text-[#25D366]">80%</p><p className="text-slate-600 text-xs mt-1">of at-risk renewals saved</p></div>
            <div><p className="text-slate-500 text-sm mb-2">Wapaci costs from</p><p className="text-4xl font-extrabold text-white">₹999</p><p className="text-slate-600 text-xs mt-1">per month</p></div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center space-y-2">
            <p className="text-slate-300 text-base md:text-lg">Gym with <span className="text-white font-bold">300 members at ₹3,000/month</span> losing 30% annually = <span className="text-red-400 font-bold">₹2.7L walking out the door.</span></p>
            <p className="text-slate-300 text-base md:text-lg mt-2">Wapaci recovers 80% of that = <span className="text-[#25D366] font-bold text-xl">₹2.16L saved every year.</span></p>
            <p className="text-slate-500 text-sm mt-4">From ₹999/month. That's 180x ROI on just renewals alone.</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

const testimonials = [
  { name: 'Deepak Sharma', role: 'Founder, Iron Nation Gym, Delhi', avatar: 'DS', color: 'bg-orange-500', quote: 'Renewal reminders alone recovered ₹1.8L in memberships we would have silently lost. Members renew without us even calling them anymore. It\'s incredible.', metric: '₹1.8L in renewals recovered' },
  { name: 'Priyanka Joshi', role: 'Owner, FitZone Studios, Bengaluru', avatar: 'PJ', color: 'bg-pink-500', quote: 'Our trial-to-paid conversion literally doubled after WhatsApp follow-ups. We were getting the same leads — we just stopped letting them go cold.', metric: '2x trial-to-member conversion' },
  { name: 'Kunal Mehta', role: 'Director, PeakFit Gym Chain', avatar: 'KM', color: 'bg-blue-500', quote: 'Managing 4 gyms was chaos before Wapaci. Now every location sends renewal reminders, batch announcements, and fee reminders automatically. I sleep better.', metric: '4 gyms, fully automated' },
]

function Testimonials() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Results</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Gyms that stopped leaking<br />revenue on WhatsApp</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1 * i + 0.2 }}
              whileHover={{ y: -4, scale: 1.02 }} className="bg-white/[0.03] border border-white/[0.08] hover:border-[#25D366]/20 rounded-2xl p-6 flex flex-col transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-4 h-4 text-[#25D366] fill-[#25D366]" />)}</div>
              <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="mt-4 mb-4"><span className="bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full">{t.metric}</span></div>
              <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>{t.avatar}</div>
                <div><p className="text-white font-semibold text-sm">{t.name}</p><p className="text-slate-500 text-xs">{t.role}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const steps = [
    { num: '01', title: 'Add your members', desc: 'Import your member list or connect your management software. Setup in under 2 minutes.', icon: Zap, accent: '#25D366' },
    { num: '02', title: 'Enable automations', desc: 'Renewal reminders, win-backs, fee collection, class broadcasts — all pre-built. Toggle on and customise.', icon: Bell, accent: '#3b82f6' },
    { num: '03', title: 'Watch retention improve', desc: 'Wapaci works 24/7. You focus on coaching and growing your gym.', icon: TrendingUp, accent: '#a855f7' },
  ]
  return (
    <section id="how-it-works" ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Live in 10 minutes.</h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">No developer. No complicated setup. Import members and go.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((s, i) => (
            <motion.div key={s.num} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55, delay: 0.15 * i }} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: `${s.accent}20`, border: `1px solid ${s.accent}30` }}><s.icon className="w-6 h-6" style={{ color: s.accent }} /></div>
              <div className="text-[#25D366]/40 text-xs font-bold tracking-widest mb-2">{s.num}</div>
              <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#25D366]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-3xl mx-auto px-5 text-center relative z-10">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex items-center justify-center w-16 h-16 bg-[#25D366]/15 border border-[#25D366]/40 rounded-2xl mb-8 shadow-xl shadow-green-500/20">
          <MessageCircle className="w-8 h-8 text-[#25D366]" />
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}} transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
          Every lapsed membership is<br /><span className="text-red-400">money you earned and then gave back.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="mt-5 text-slate-400 text-lg">
          Stop losing members silently. Wapaci fights for every renewal, every trial, every lapsed member — automatically, on WhatsApp.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={UTM} className="group inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
            Start your 7-day free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Cancel anytime</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.8, delay: 0.5 }} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {['🔒 WhatsApp Business API', '🇮🇳 Built for Indian gyms', '⚡ Setup in 10 minutes', '✅ Works for single & chain gyms'].map(b => (
            <span key={b} className="text-slate-500 text-sm">{b}</span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-[#070b12] border-t border-white/5 py-8">
      <div className="max-w-5xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center group-hover:scale-105 transition"><MessageCircle className="w-3.5 h-3.5 text-white" /></div>
          <span className="text-white font-bold text-sm">Wapaci</span>
        </Link>
        <div className="flex items-center gap-4 text-slate-500 text-xs">
          <Link href="/privacy-policy" className="hover:text-slate-300 transition">Privacy</Link>
          <span>·</span><Link href="/terms" className="hover:text-slate-300 transition">Terms</Link>
          <span>·</span><Link href="/contact" className="hover:text-slate-300 transition">Contact</Link>
          <span>·</span><span>© {new Date().getFullYear()} Wapaci</span>
        </div>
      </div>
    </footer>
  )
}

export default function GymLanding() {
  return (
    <>
      <AuroraBg />
      <main className="antialiased relative" style={{ zIndex: 1 }}>
        <ScrollProgress />
        <Header />
        <Hero />
        <StatsBar />
        <ProblemSection />
        <FeaturesSection />
        <TheMath />
        <Testimonials />
        <HowItWorks />
        <FinalCTA />
        <Footer />
      </main>
    </>
  )
}

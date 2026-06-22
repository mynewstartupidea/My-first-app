'use client'

import { motion, useInView, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, ArrowRight, CheckCircle2, Home, Calendar, FileText, Users, Zap, CreditCard, TrendingUp, Check, X, Star } from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import ScrollProgress from '@/components/landing/scroll-progress'

const UTM = '/signup?utm_source=facebook&utm_campaign=realestate-lp'

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
        <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-105 transition">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
      <Link href={UTM} className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-green-500/30 hover:scale-[1.03] active:scale-[0.98]">
        Start free trial <ArrowRight className="w-4 h-4" />
      </Link>
    </header>
  )
}

const heroLines = [
  { text: 'Your leads replied', color: 'text-white' },
  { text: 'in 3 seconds.', color: 'text-[#25D366]' },
  { text: 'Your team replied', color: 'text-white' },
  { text: 'in 3 hours.', color: 'text-red-400' },
]

const chat = [
  { type: 'bot' as const, text: '🏠 Hi Rahul! Thanks for your interest in Skyline Heights, Pune.', time: '10:42 AM' },
  { type: 'bot' as const, text: '2BHK & 3BHK starting ₹68L. Shall I send the floor plans? 📋', time: '10:42 AM' },
  { type: 'user' as const, text: 'Yes! And can I visit the site this weekend?', time: '10:44 AM' },
  { type: 'bot' as const, text: '✅ Saturday 11 AM confirmed! Our team will meet you at the gate.', time: '10:44 AM' },
  { type: 'bot' as const, text: 'Brochure + location → skylineheights.in/visit 📍', time: '10:44 AM' },
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
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">WhatsApp for Real Estate · Developers & Brokers</span>
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
            78% of buyers go with the first developer who responds. Wapaci auto-replies every inquiry on WhatsApp in seconds, books site visits, and nurtures cold leads until they're ready to buy.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link href={UTM} className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
              Start free — respond first, win more <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
            <p className="text-[11px] text-slate-400">Site visit booked</p>
            <p className="text-white font-bold text-sm">Saturday 11 AM · Skyline Heights</p>
            <p className="text-[#25D366] text-[11px] font-semibold mt-0.5">2 min after inquiry ✓</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.0, duration: 0.5 }}
            className="absolute -right-2 bottom-20 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm text-center">
            <p className="text-3xl font-extrabold text-[#25D366]">78%</p>
            <p className="text-[11px] text-slate-400">buyers go with<br />first responder</p>
          </motion.div>
          <div className="relative w-[290px] bg-[#0a0f1a] rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0a0f1a] rounded-b-xl z-10" />
            <div className="bg-[#075E54] px-4 pt-8 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center"><Home className="w-4 h-4 text-white" /></div>
              <div><p className="text-white font-semibold text-sm">Skyline Realty Bot</p><p className="text-green-200 text-[11px]">Online · replies instantly</p></div>
            </div>
            <div className="bg-[#0d1117] px-3 py-4 space-y-2.5 min-h-[350px]">
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
              <div className="flex-1 bg-[#1a2533] rounded-full px-3 py-2 text-slate-600 text-xs">Reply to lead...</div>
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0"><ArrowRight className="w-3.5 h-3.5 text-white" /></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

const statsConfig = [
  { target: 340, suffix: '+', prefix: '', decimals: 0, label: 'Real estate businesses' },
  { target: 78, suffix: '%', prefix: '', decimals: 0, label: 'Buyers go with first responder' },
  { target: 98, suffix: '%', prefix: '', decimals: 0, label: 'WhatsApp open rate' },
  { target: 10, suffix: 'min', prefix: '', decimals: 0, label: 'Average setup time' },
]

function StatsBar() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const v0 = useCountUp(statsConfig[0].target, inView)
  const v1 = useCountUp(statsConfig[1].target, inView)
  const v2 = useCountUp(statsConfig[2].target, inView)
  const v3 = useCountUp(statsConfig[3].target, inView)
  const vals = [v0, v1, v2, v3]
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
  const leftRows = [
    { label: 'Response time', value: '2–6 hours (if you\'re lucky)' },
    { label: 'Lead sees your message', value: 'Maybe. If they check email.' },
    { label: 'Competitor calls first', value: 'Almost always' },
    { label: 'Site visit booked', value: 'Rarely' },
    { label: 'Lead gone cold', value: 'Within 24 hours' },
  ]
  const rightRows = [
    { label: 'Response time', value: 'Under 30 seconds, always' },
    { label: 'Lead sees your message', value: '98% open rate — guaranteed' },
    { label: 'You respond first', value: 'Every single time' },
    { label: 'Site visit booked', value: 'Automatically, in the same chat' },
    { label: 'Lead stays warm', value: 'Nurtured at 7 / 14 / 30 days' },
  ]
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The problem</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">The builder who responds first wins.<br />Right now, that's not you.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">A lead submits an inquiry on 99acres or your website. In the next 10 minutes, they inquire with 3 more developers. Your IVR system puts them on hold. One competitor is already on WhatsApp.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">📞</span><span className="text-red-400 font-bold">Without Wapaci</span></div>
            <div className="space-y-3.5">
              {leftRows.map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 text-sm shrink-0">{row.label}</span>
                  <span className="text-red-400 font-semibold text-sm flex items-center gap-1.5 text-right"><X className="w-3.5 h-3.5 shrink-0" />{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="bg-[#25D366]/5 border border-[#25D366]/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">💬</span><span className="text-[#25D366] font-bold">With Wapaci</span></div>
            <div className="space-y-3.5">
              {rightRows.map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 text-sm shrink-0">{row.label}</span>
                  <span className="text-[#25D366] font-semibold text-sm flex items-center gap-1.5 text-right"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 text-center text-slate-400 text-lg italic max-w-2xl mx-auto">
          "That lead wasn't lost. They were just waiting for someone to respond.<br /><span className="text-white font-semibold not-italic">Wapaci makes sure that someone is you."</span>
        </motion.p>
      </div>
    </section>
  )
}

const features = [
  { icon: Zap, title: 'Instant Lead Response', desc: 'Every inquiry gets a WhatsApp reply in under 30 seconds — automatically. Project details, pricing, and next steps delivered before they move on.', accent: '#25D366', glow: 'rgba(37,211,102,0.15)', border: 'rgba(37,211,102,0.25)', stat: 'Respond before competitors' },
  { icon: Calendar, title: 'Site Visit Scheduling', desc: 'Leads pick a slot and get confirmed instantly on WhatsApp. Automated reminders reduce no-shows by 60%.', accent: '#3b82f6', glow: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.2)', stat: '60% fewer no-shows' },
  { icon: FileText, title: 'Brochure & Floor Plan Sharing', desc: 'Send project brochures, floor plans, and price lists on WhatsApp — where 98% will actually open it, not a download link buried in an email.', accent: '#f97316', glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.2)', stat: '98% document open rate' },
  { icon: Users, title: 'Lead Nurture Sequences', desc: 'Leads who visit but don\'t book? Wapaci follows up at 7, 14, and 30 days with new photos, testimonials, and offers. Warm them until they\'re ready.', accent: '#a855f7', glow: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.2)', stat: '3x lead-to-booking rate' },
  { icon: Home, title: 'New Launch Broadcasts', desc: 'Announce a new project to your entire database of interested buyers in one click. 98% will see it. Most will respond.', accent: '#ec4899', glow: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.2)', stat: '5x vs email broadcasts' },
  { icon: CreditCard, title: 'Payment Milestone Reminders', desc: 'Token amount, booking amount, installments — automated reminders that keep buyers on track without your team chasing them.', accent: '#eab308', glow: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.2)', stat: 'Zero missed milestones' },
]

function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What Wapaci does</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">From inquiry to booking.<br />All on WhatsApp. All automatic.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">Works for developers with large projects and brokers managing multiple listings — all from one dashboard.</p>
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
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">One extra closing per month.<br />What does that mean for you?</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-6 text-center mb-8">
            <div><p className="text-slate-500 text-sm mb-2">Leads lost to slow response</p><p className="text-4xl font-extrabold text-red-400">60%</p><p className="text-slate-600 text-xs mt-1">of inquiries go cold</p></div>
            <div><p className="text-slate-500 text-sm mb-2">Wapaci response time</p><p className="text-4xl font-extrabold text-[#25D366]">&lt;30 sec</p><p className="text-slate-600 text-xs mt-1">every single inquiry</p></div>
            <div><p className="text-slate-500 text-sm mb-2">Wapaci costs from</p><p className="text-4xl font-extrabold text-white">₹999</p><p className="text-slate-600 text-xs mt-1">per month</p></div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center space-y-2">
            <p className="text-slate-300 text-base md:text-lg">If you get <span className="text-white font-bold">50 leads/month</span> and convert just <span className="text-white font-bold">1 extra unit</span> from faster follow-up...</p>
            <p className="text-slate-300 text-base md:text-lg mt-2">At <span className="text-white font-bold">₹50L/unit,</span> that's <span className="text-[#25D366] font-bold text-xl">₹50L in revenue from ₹999/month.</span></p>
            <p className="text-slate-500 text-sm mt-4">50,000x ROI. Not a typo.</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

const testimonials = [
  { name: 'Vikram Malhotra', role: 'Director, Skyline Realty, Pune', avatar: 'VM', color: 'bg-blue-500', quote: 'We were losing 60% of our leads because our sales team couldn\'t respond fast enough. Wapaci auto-replies every inquiry in seconds and books site visits automatically. Conversions up 40%.', metric: '40% more site visit conversions' },
  { name: 'Meera Iyer', role: 'Independent Broker, Mumbai', avatar: 'MI', color: 'bg-pink-500', quote: 'I handle 60+ inquiries a week by myself. Wapaci follows up with every lead while I focus on the hot ones. Closed 3 extra deals last month without hiring anyone.', metric: '3 extra deals/month, solo' },
  { name: 'Rajesh Singhania', role: 'MD, Singhania Developers, Hyderabad', avatar: 'RS', color: 'bg-orange-500', quote: 'Our payment reminders used to be a manual process. Now Wapaci handles installment reminders automatically. Zero missed payments last quarter.', metric: '0 missed payment milestones' },
]

function Testimonials() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Results</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Developers and brokers<br />closing more on WhatsApp</h2>
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

const steps = [
  { num: '01', title: 'Connect your leads', desc: 'Link your 99acres, MagicBricks, or website inquiry form. Or upload your lead list CSV.', icon: Zap, accent: '#25D366' },
  { num: '02', title: 'Set up your automations', desc: 'Instant reply, site visit booking, follow-up sequences — all pre-built. Toggle on, customise your message.', icon: Home, accent: '#3b82f6' },
  { num: '03', title: 'Close more deals', desc: 'Wapaci handles follow-ups. You show up to site visits with warm, ready buyers.', icon: TrendingUp, accent: '#a855f7' },
]

function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section id="how-it-works" ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Live in 10 minutes.</h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">No developer. No complicated setup. Connect your leads and start responding in seconds.</p>
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
          Every lead that goes cold is<br /><span className="text-red-400">a crore walking out the door.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="mt-5 text-slate-400 text-lg">
          Join 340+ real estate businesses who respond first, follow up automatically, and close more — on WhatsApp.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={UTM} className="group inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
            Start your 7-day free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Cancel anytime</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.8, delay: 0.5 }} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {['🔒 WhatsApp Business API', '🇮🇳 Built for Indian real estate', '⚡ Setup in 10 minutes', '✅ Works for developers & brokers'].map(b => (
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

export default function RealEstateLanding() {
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

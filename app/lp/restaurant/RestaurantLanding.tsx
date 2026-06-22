'use client'

import { motion, useInView, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, ArrowRight, CheckCircle2, Star, Calendar, RefreshCw, Zap, BarChart3, Package, TrendingUp, Check, X } from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import ScrollProgress from '@/components/landing/scroll-progress'

const UTM = '/signup?utm_source=facebook&utm_campaign=restaurant-lp'

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
  { text: 'Zomato charges', color: 'text-white' },
  { text: '30% commission.', color: 'text-red-400' },
  { text: 'WhatsApp charges', color: 'text-white' },
  { text: 'nothing.', color: 'text-[#25D366]' },
]

const chat = [
  { type: 'bot' as const, text: "🍛 Today's special: Butter Chicken Thali ₹199 (save ₹80!) 😋", time: '11:30 AM' },
  { type: 'bot' as const, text: 'Available today 12–3 PM only. Want to book a table? 🍽️', time: '11:30 AM' },
  { type: 'user' as const, text: 'Yes! Table for 2 at 1 PM please', time: '11:33 AM' },
  { type: 'bot' as const, text: '✅ Booked! 2 pax, 1 PM. Show this for a free dessert 🍮', time: '11:33 AM' },
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
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">WhatsApp for Restaurants, Cafes & Cloud Kitchens</span>
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
            You built the customer base. You cooked the food. Why is Zomato taking 30% to send your customers a message? Wapaci puts your customers back in your hands — on WhatsApp.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }} className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link href={UTM} className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
              Own your customers — free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
            <p className="text-[11px] text-slate-400">Table booked from broadcast</p>
            <p className="text-white font-bold text-sm">2 pax · 1 PM today · Spice Garden</p>
            <p className="text-[#25D366] text-[11px] font-semibold mt-0.5">Commission paid: ₹0 ✓</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.0, duration: 0.5 }}
            className="absolute -right-2 bottom-20 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm text-center">
            <p className="text-3xl font-extrabold text-red-400">30%</p>
            <p className="text-[11px] text-slate-400">Zomato takes<br />from every order</p>
          </motion.div>
          <div className="relative w-[290px] bg-[#0a0f1a] rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0a0f1a] rounded-b-xl z-10" />
            <div className="bg-[#075E54] px-4 pt-8 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center"><Package className="w-4 h-4 text-white" /></div>
              <div><p className="text-white font-semibold text-sm">Spice Garden Bot</p><p className="text-green-200 text-[11px]">Online · replies instantly</p></div>
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
              <div className="flex-1 bg-[#1a2533] rounded-full px-3 py-2 text-slate-600 text-xs">Reply to customer...</div>
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0"><ArrowRight className="w-3.5 h-3.5 text-white" /></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

const statsConfig = [
  { target: 30, suffix: '%', prefix: '', decimals: 0, label: 'Zomato/Swiggy commission' },
  { target: 40, suffix: '%', prefix: '', decimals: 0, label: 'Repeat orders via WhatsApp' },
  { target: 98, suffix: '%', prefix: '', decimals: 0, label: 'WhatsApp open rate' },
  { target: 0, suffix: '%', prefix: '', decimals: 0, label: 'Wapaci commission per order' },
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
            <p className={`text-2xl md:text-3xl font-extrabold tabular-nums ${i === 0 ? 'text-red-400' : i === 3 ? 'text-[#25D366]' : 'text-white'}`}>{s.prefix}{vals[i].toFixed(s.decimals)}{s.suffix}</p>
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
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">You're making Zomato rich<br />with YOUR customers.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">Every repeat order that goes through Zomato or Swiggy costs you 25–30%. But these are YOUR customers — they already know you, love your food, and want to order again. You just need a direct line.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">🛵</span><span className="text-red-400 font-bold">Zomato / Swiggy model</span></div>
            <div className="space-y-3.5">
              {[
                { label: 'Commission per order', value: '25–30%' },
                { label: 'Customer data', value: 'Zomato owns it, not you' },
                { label: 'Direct communication', value: 'Impossible through platform' },
                { label: 'Running a Monday offer', value: 'Pay for a promotion' },
                { label: 'Repeat customer loyalty', value: 'Goes to Zomato, not you' },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 text-sm shrink-0">{row.label}</span>
                  <span className="text-red-400 font-semibold text-sm flex items-center gap-1.5"><X className="w-3.5 h-3.5 shrink-0" />{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="bg-[#25D366]/5 border border-[#25D366]/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6"><span className="text-xl">💬</span><span className="text-[#25D366] font-bold">Wapaci WhatsApp model</span></div>
            <div className="space-y-3.5">
              {[
                { label: 'Commission per order', value: '₹0. Zero. Nil.' },
                { label: 'Customer data', value: 'Yours. Always.' },
                { label: 'Direct communication', value: '98% open rate on WhatsApp' },
                { label: 'Running a Monday offer', value: 'One broadcast, done in 30 sec' },
                { label: 'Repeat customer loyalty', value: 'Belongs to your restaurant' },
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
  { icon: Zap, title: 'Daily Specials Broadcast', desc: 'Send today\'s special to your customer list every morning. Drive footfall and direct orders on demand — with zero commission.', accent: '#25D366', glow: 'rgba(37,211,102,0.15)', border: 'rgba(37,211,102,0.25)', stat: '35% more covers on slow days' },
  { icon: Calendar, title: 'Table Booking & Reminders', desc: 'Customers book directly on WhatsApp. Automated confirmations and reminders. No more ghost tables on a busy Saturday.', accent: '#3b82f6', glow: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.2)', stat: '70% fewer no-shows' },
  { icon: Star, title: 'Loyalty Rewards', desc: 'After every 5th visit or order, automatically send a reward. Customers feel seen. They come back. No loyalty card needed.', accent: '#eab308', glow: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.2)', stat: '2.5x repeat visit rate' },
  { icon: RefreshCw, title: 'Win-back Offers', desc: 'Customers who haven\'t visited in 30 days get a personalised offer. "We miss you, Priya — here\'s 20% off your next meal."', accent: '#a855f7', glow: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.2)', stat: '40% win-back rate' },
  { icon: BarChart3, title: 'Festive & Occasion Campaigns', desc: 'Diwali, New Year, Valentine\'s Day, Eid — send a curated offer to your whole list in one click. The right message at the right moment.', accent: '#ec4899', glow: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.2)', stat: '5x vs email campaigns' },
  { icon: Package, title: 'Review Collection', desc: 'After every dine-in or delivery, automatically request a Google review. More 5-stars = more organic footfall.', accent: '#f97316', glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.2)', stat: '4x more Google reviews' },
]

function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What Wapaci does</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Fill tables. Drive repeat orders.<br />Own your customers.</h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">Works for dine-in restaurants, cafes, cloud kitchens, and multi-outlet chains — anywhere you have customers worth keeping.</p>
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
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">How much of your revenue<br />is Zomato keeping?</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-6 text-center mb-8">
            <div><p className="text-slate-500 text-sm mb-2">Zomato commission rate</p><p className="text-4xl font-extrabold text-red-400">30%</p><p className="text-slate-600 text-xs mt-1">of every online order</p></div>
            <div><p className="text-slate-500 text-sm mb-2">WhatsApp direct orders</p><p className="text-4xl font-extrabold text-[#25D366]">0%</p><p className="text-slate-600 text-xs mt-1">commission taken</p></div>
            <div><p className="text-slate-500 text-sm mb-2">Wapaci costs from</p><p className="text-4xl font-extrabold text-white">₹999</p><p className="text-slate-600 text-xs mt-1">per month flat</p></div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center space-y-2">
            <p className="text-slate-300 text-base md:text-lg">Restaurant doing <span className="text-white font-bold">₹3L/month via Zomato</span> pays <span className="text-red-400 font-bold">₹90,000 in commission monthly.</span></p>
            <p className="text-slate-300 text-base md:text-lg mt-2">Move just 30% of those orders to WhatsApp direct = <span className="text-[#25D366] font-bold text-xl">save ₹27,000/month.</span></p>
            <p className="text-slate-500 text-sm mt-4">Wapaci costs ₹999/month. The math writes itself.</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

const testimonials = [
  { name: 'Aakash Gupta', role: 'Owner, Spice Garden, Jaipur', avatar: 'AG', color: 'bg-orange-500', quote: 'We send a daily special to 2,300 customers every morning. Lunch footfall increased 35% in 6 weeks. Zero ad spend. Zero Zomato commission. Just WhatsApp.', metric: '35% more lunch covers' },
  { name: 'Divya Nair', role: 'Founder, The Chai Corner (cloud kitchen)', avatar: 'DN', color: 'bg-pink-500', quote: 'Stopped depending on Swiggy for repeat orders. 40% of our orders now come directly through WhatsApp. The commission savings paid for Wapaci 20x over.', metric: '40% direct repeat orders' },
  { name: 'Sameer Khan', role: 'Co-founder, Bandra Bites (3 outlets)', avatar: 'SK', color: 'bg-blue-500', quote: 'Our Diwali campaign hit 96% open rate and sold out all 3 outlets for the weekend. One message, 8,000 customers, ₹0 commission. Can\'t go back to Zomato ads.', metric: 'All 3 outlets sold out, Diwali' },
]

function Testimonials() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Results</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Restaurants that took back<br />their customers from the platforms</h2>
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
    { num: '01', title: 'Build your customer list', desc: 'Import your existing customer data or let Wapaci collect opt-ins from your menu QR code or checkout.', icon: Zap, accent: '#25D366' },
    { num: '02', title: 'Set up your automations', desc: 'Daily specials, table booking, loyalty rewards, win-backs — all pre-built. Customise your brand\'s tone.', icon: Calendar, accent: '#3b82f6' },
    { num: '03', title: 'Fill tables, earn more', desc: 'Every message goes straight to your customer\'s WhatsApp. No algorithm. No commission. Just your food.', icon: TrendingUp, accent: '#a855f7' },
  ]
  return (
    <section id="how-it-works" ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Live in 10 minutes.</h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">No developer. No tech team. Just your menu and your customers.</p>
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
          Your best customers are eating out tonight.<br /><span className="text-[#25D366]">Did you send them a message?</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 }} className="mt-5 text-slate-400 text-lg">
          Own your customer relationships. Fill tables on your terms. Keep 100% of every order that comes through WhatsApp.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={UTM} className="group inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-2xl shadow-green-500/40 hover:scale-[1.03] active:scale-[0.98]">
            Start your 7-day free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Cancel anytime</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.8, delay: 0.5 }} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {['🔒 WhatsApp Business API', '🇮🇳 Built for Indian restaurants', '⚡ Setup in 10 minutes', '₹0 per order commission'].map(b => (
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

export default function RestaurantLanding() {
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

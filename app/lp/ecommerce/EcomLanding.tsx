'use client'

import {
  motion, useInView, useScroll, useTransform,
  useSpring, useMotionValue,
} from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageCircle, ArrowRight, CheckCircle2, ShoppingCart,
  Package, RefreshCw, Star, CreditCard, BarChart3, Zap,
  TrendingUp, Check, X,
} from 'lucide-react'
import AuroraBg from '@/components/landing/aurora-bg'
import ScrollProgress from '@/components/landing/scroll-progress'

// ─── COUNT-UP ──────────────────────────────────────────────────────────────
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

// ─── TILT CARD ─────────────────────────────────────────────────────────────
function TiltCard({ children, glow, border }: { children: React.ReactNode; glow: string; border: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 260, damping: 24 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 260, damping: 24 })
  const glowX   = useTransform(mx, [-0.5, 0.5], [0, 100])
  const glowY   = useTransform(my, [-0.5, 0.5], [0, 100])

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    mx.set((e.clientX - r.left) / r.width  - 0.5)
    my.set((e.clientY - r.top)  / r.height - 0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0) }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800, borderColor: border, borderWidth: 1, borderStyle: 'solid' }}
      whileHover={{ scale: 1.03 }}
      transition={{ scale: { type: 'spring', stiffness: 300, damping: 22 } }}
      className="relative rounded-2xl bg-[#080f1a] overflow-hidden cursor-default group"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glow} 0%, transparent 55%)` }}
      />
      <div style={{ transform: 'translateZ(20px)' }} className="relative p-6 h-full">
        {children}
      </div>
    </motion.div>
  )
}

// ─── HEADER ────────────────────────────────────────────────────────────────
function EcomHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-[#030812]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-105 transition">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
      <Link
        href="/signup?utm_source=facebook&utm_campaign=ecom-lp"
        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-green-500/30 hover:scale-[1.03] active:scale-[0.98]"
      >
        Start free trial
        <ArrowRight className="w-4 h-4" />
      </Link>
    </header>
  )
}

// ─── HERO ──────────────────────────────────────────────────────────────────
const heroLines = [
  { text: 'Cart abandoned.', color: 'text-white' },
  { text: 'Email unread.', color: 'text-red-400' },
  { text: 'WhatsApp message?', color: 'text-white' },
  { text: 'Order placed. ✓', color: 'text-[#25D366]' },
]

const chatMessages = [
  { type: 'bot' as const, text: '👟 Hi Priya! You left Nike Air Force 1s in your cart.', time: '2:31 PM' },
  { type: 'bot' as const, text: 'Your size (UK 6, White) has only 2 left in stock! 🔥', time: '2:31 PM' },
  { type: 'bot' as const, text: 'Grab them before they\'re gone → stylestore.in/cart/priya 🛒', time: '2:32 PM' },
  { type: 'user' as const, text: "Ok ordering right now! 😊", time: '2:34 PM' },
  { type: 'bot' as const, text: '🎉 Use COMEBACK10 for 10% off — valid 2 hrs only!', time: '2:34 PM' },
]

function ChatBubble({ msg, index, inView }: {
  msg: typeof chatMessages[0]
  index: number
  inView: boolean
}) {
  const isUser = msg.type === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.35, delay: 0.9 + index * 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
        isUser ? 'bg-[#25D366] text-white rounded-br-sm' : 'bg-[#1a2533] text-slate-200 rounded-bl-sm'
      }`}>
        <p>{msg.text}</p>
        <p className={`text-[10px] mt-0.5 text-right ${isUser ? 'text-green-100' : 'text-slate-500'}`}>
          {msg.time}{isUser && ' ✓✓'}
        </p>
      </div>
    </motion.div>
  )
}

function EcomHero() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60])

  return (
    <section ref={ref} className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="hero-grid" />
      <motion.div style={{ y: contentY }} className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">

        {/* Copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8"
          >
            <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">WhatsApp Marketing · 340+ D2C brands</span>
          </motion.div>

          <h1 className="font-extrabold leading-[1.1] tracking-tight mb-6">
            {heroLines.map((line, i) => (
              <motion.div
                key={line.text}
                initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.1 * i }}
                className={`block text-4xl md:text-5xl lg:text-[3.2rem] ${line.color}`}
              >
                {line.text}
              </motion.div>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-slate-400 text-lg leading-relaxed max-w-lg mb-8"
          >
            98% of WhatsApp messages are read within 3 minutes. Wapaci sends automatic cart recovery, COD verification, and win-back messages — all on autopilot.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-3 mb-8"
          >
            <Link
              href="/signup?utm_source=facebook&utm_campaign=ecom-lp"
              className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-4 rounded-2xl text-base transition-all duration-200 shadow-2xl shadow-green-500/40 hover:shadow-green-500/60 hover:scale-[1.03] active:scale-[0.98]"
            >
              Recover carts free — 7 days
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-7 py-4 rounded-2xl text-base transition-all duration-200"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-wrap gap-5"
          >
            {['No credit card required', 'Setup in 10 minutes', 'Official WhatsApp Business API'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-slate-500 text-sm">
                <Check className="w-3.5 h-3.5 text-[#25D366]" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Phone mockup */}
        <motion.div
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center lg:justify-end"
        >
          {/* Floating badge — order recovered */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2.5, duration: 0.5 }}
            className="absolute -left-4 top-10 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm"
          >
            <p className="text-[11px] text-slate-400">Order recovered</p>
            <p className="text-white font-bold text-sm">₹7,499 · Nike Air Force 1</p>
            <p className="text-[#25D366] text-[11px] font-semibold mt-0.5">2 min after WhatsApp reminder ✓</p>
          </motion.div>

          {/* Open rate badge */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2.0, duration: 0.5 }}
            className="absolute -right-2 bottom-20 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20 backdrop-blur-sm text-center"
          >
            <p className="text-3xl font-extrabold text-[#25D366]">98%</p>
            <p className="text-[11px] text-slate-400">messages read</p>
          </motion.div>

          {/* Phone */}
          <div className="relative w-[290px] bg-[#0a0f1a] rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0a0f1a] rounded-b-xl z-10" />
            {/* WhatsApp header */}
            <div className="bg-[#075E54] px-4 pt-8 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">StyleStore Bot</p>
                <p className="text-green-200 text-[11px]">Online · replies instantly</p>
              </div>
            </div>
            {/* Chat */}
            <div className="bg-[#0d1117] px-3 py-4 space-y-2.5 min-h-[350px]">
              {chatMessages.map((msg, i) => (
                <ChatBubble key={i} msg={msg} index={i} inView={inView} />
              ))}
            </div>
            {/* Input */}
            <div className="bg-[#0d1117] px-3 pb-8 pt-2 flex items-center gap-2 border-t border-white/5">
              <div className="flex-1 bg-[#1a2533] rounded-full px-3 py-2 text-slate-600 text-xs">Reply to customer...</div>
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0">
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ─── STATS BAR ─────────────────────────────────────────────────────────────
const statsConfig = [
  { target: 340,  suffix: '+',   prefix: '',  decimals: 0, label: 'D2C brands on Wapaci' },
  { target: 8.4,  suffix: 'Cr',  prefix: '₹', decimals: 1, label: 'Revenue recovered' },
  { target: 35,   suffix: '%',   prefix: '',  decimals: 0, label: 'Avg cart recovery rate' },
  { target: 98,   suffix: '%',   prefix: '',  decimals: 0, label: 'WhatsApp open rate' },
]

function StatsBar() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const v0 = useCountUp(statsConfig[0].target, inView, 1.8)
  const v1 = useCountUp(statsConfig[1].target, inView, 1.8)
  const v2 = useCountUp(statsConfig[2].target, inView, 1.8)
  const v3 = useCountUp(statsConfig[3].target, inView, 1.8)
  const vals = [v0, v1, v2, v3]

  return (
    <section ref={ref} className="bg-[#030812] border-y border-white/5 py-10">
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-6">
        {statsConfig.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.1 * i }}
            className="text-center"
          >
            <p className="text-2xl md:text-3xl font-extrabold text-white tabular-nums">
              {s.prefix}{vals[i].toFixed(s.decimals)}{s.suffix}
            </p>
            <p className="text-slate-500 text-sm mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ─── PROBLEM SECTION ───────────────────────────────────────────────────────
function ProblemSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const emailRows = [
    { label: 'Open rate',          value: '~20%' },
    { label: 'Lands in',           value: 'Promotions tab' },
    { label: 'Read within 3 min',  value: '5%' },
    { label: 'Feels personal',     value: 'Never' },
    { label: 'Customer replies',   value: 'Almost never' },
  ]
  const waRows = [
    { label: 'Open rate',          value: '98%' },
    { label: 'Lands in',           value: 'Personal chat inbox' },
    { label: 'Read within 3 min',  value: '90%+' },
    { label: 'Feels personal',     value: 'Yes — like a text from a friend' },
    { label: 'Customer replies',   value: 'Frequently' },
  ]

  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The problem</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Your cart recovery emails are<br />landing in the wrong place.
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            They hit the Promotions tab, get buried under Zomato discounts and Amazon deals. Your customer never sees it. The sale is gone.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Email — bad */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">📧</span>
              <span className="text-red-400 font-bold">Cart recovery email</span>
            </div>
            <div className="space-y-3.5">
              {emailRows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">{row.label}</span>
                  <span className="text-red-400 font-semibold text-sm flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 flex-shrink-0" />{row.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* WhatsApp — good */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#25D366]/5 border border-[#25D366]/25 rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">💬</span>
              <span className="text-[#25D366] font-bold">WhatsApp cart recovery</span>
            </div>
            <div className="space-y-3.5">
              {waRows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">{row.label}</span>
                  <span className="text-[#25D366] font-semibold text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{row.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 text-center text-slate-400 text-lg italic max-w-2xl mx-auto"
        >
          "Your customer put that product in the cart. They were THIS close.<br />
          <span className="text-white font-semibold not-italic">One WhatsApp message brings them back."</span>
        </motion.p>
      </div>
    </section>
  )
}

// ─── FEATURES ──────────────────────────────────────────────────────────────
const features = [
  {
    icon: ShoppingCart,
    title: 'Abandoned Cart Recovery',
    desc: 'Personalised reminders at 30 min, 1 hr, and 24 hrs. Includes product name, image link, and cart restore URL.',
    accent: '#25D366',
    glow: 'rgba(37,211,102,0.15)',
    border: 'rgba(37,211,102,0.25)',
    stat: 'Up to 35% recovery rate',
  },
  {
    icon: CreditCard,
    title: 'COD Verification',
    desc: 'Confirm Cash on Delivery orders before dispatch. Customers reply YES or NO — cutting RTO losses by up to 60%.',
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.15)',
    border: 'rgba(249,115,22,0.2)',
    stat: '60% fewer RTOs',
  },
  {
    icon: Package,
    title: 'Order & Shipping Updates',
    desc: 'Automated messages for every status — confirmed, shipped, out for delivery, delivered. Kills support tickets.',
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.2)',
    stat: '90% fewer queries',
  },
  {
    icon: RefreshCw,
    title: 'Win-back Campaigns',
    desc: 'Re-engage customers at 30/60/90-day windows with personalised offers. The ones who ghosted? They\'ll be back.',
    accent: '#a855f7',
    glow: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.2)',
    stat: '2.4x repeat orders',
  },
  {
    icon: BarChart3,
    title: 'Broadcast Promotions',
    desc: 'Flash sales, new collections, festive campaigns — reach your whole list in one click with 98% open rate.',
    accent: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    border: 'rgba(236,72,153,0.2)',
    stat: '5x vs email open rate',
  },
  {
    icon: Star,
    title: 'Review Collection',
    desc: 'Automatically request a Google or Trustpilot review after every delivery. More reviews = more organic sales.',
    accent: '#eab308',
    glow: 'rgba(234,179,8,0.15)',
    border: 'rgba(234,179,8,0.2)',
    stat: '4x more reviews',
  },
]

function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(37,211,102,0.05) 0%, transparent 65%)', filter: 'blur(40px)' }}
      />
      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What Wapaci does</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Every automation your store needs.<br />Set up once. Runs forever.
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            From the moment a cart is abandoned to the review after delivery — Wapaci handles it all so you don't have to.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 50, filter: 'blur(8px)' }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.55, delay: 0.07 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <TiltCard glow={f.glow} border={f.border}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.accent}20`, border: `1px solid ${f.accent}40` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.accent }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                <div className="mt-5 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit" style={{ color: f.accent, background: `${f.accent}15` }}>
                  {f.stat}
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── THE MATH ──────────────────────────────────────────────────────────────
function TheMath() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="bg-[#030812] py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-4xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The math</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            How much is your store<br />losing right now?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-10"
        >
          <div className="grid md:grid-cols-3 gap-6 text-center mb-8">
            <div>
              <p className="text-slate-500 text-sm mb-2">Industry cart abandonment rate</p>
              <p className="text-4xl font-extrabold text-red-400">68%</p>
              <p className="text-slate-600 text-xs mt-1">of shoppers don't complete checkout</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm mb-2">WhatsApp recovery rate</p>
              <p className="text-4xl font-extrabold text-[#25D366]">25–35%</p>
              <p className="text-slate-600 text-xs mt-1">of those abandoned carts recovered</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm mb-2">Wapaci costs from</p>
              <p className="text-4xl font-extrabold text-white">₹999</p>
              <p className="text-slate-600 text-xs mt-1">per month, all-inclusive</p>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8">
            <p className="text-center text-slate-300 text-base md:text-lg leading-relaxed">
              Store doing <span className="text-white font-bold">₹5L/month?</span> You're losing ~<span className="text-red-400 font-bold">₹3.4L to abandoned carts.</span>
            </p>
            <p className="text-center text-slate-300 text-base md:text-lg leading-relaxed mt-2">
              Recover 30% of that = <span className="text-[#25D366] font-bold text-xl">₹1,00,000+ extra every month.</span>
            </p>
            <p className="text-center text-slate-500 text-sm mt-4">
              That's a 100x return on your ₹999/month. <span className="text-slate-400">No, we're not joking.</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── TESTIMONIALS ──────────────────────────────────────────────────────────
const testimonials = [
  {
    name: 'Rahul Mehta',
    role: 'Founder, KidsCraft India (D2C)',
    avatar: 'RM',
    color: 'bg-orange-500',
    quote: 'Recovered ₹2.1L in the very first month purely from cart recovery. Setup took 7 minutes. I genuinely can\'t believe I waited so long.',
    metric: '₹2.1L recovered — month 1',
  },
  {
    name: 'Sneha Gupta',
    role: 'Co-founder, The Candle Co.',
    avatar: 'SG',
    color: 'bg-pink-500',
    quote: 'Our Diwali broadcast went to 4,200 customers with a 96% open rate. We sold out in 4 hours. Email would\'ve taken days and landed in spam.',
    metric: 'Sold out in 4 hours',
  },
  {
    name: 'Arjun Nair',
    role: 'Founder, FitFuel Nutrition',
    avatar: 'AN',
    color: 'bg-blue-500',
    quote: 'COD verification alone cut our RTO rate from 28% to 9%. The money saved paid for Wapaci 10x over — before the month even ended.',
    metric: 'RTO dropped 28% → 9%',
  },
]

function Testimonials() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Results</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            D2C brands are printing money<br />with WhatsApp
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i + 0.2 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white/[0.03] border border-white/[0.08] hover:border-[#25D366]/20 rounded-2xl p-6 flex flex-col transition-all duration-300"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="mt-4 mb-4">
                <span className="bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full">
                  {t.metric}
                </span>
              </div>
              <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS ──────────────────────────────────────────────────────────
const steps = [
  {
    num: '01',
    title: 'Connect your store',
    desc: 'Shopify, WooCommerce, or upload a CSV. Takes under 2 minutes. No developer needed.',
    icon: Zap,
    accent: '#25D366',
  },
  {
    num: '02',
    title: 'Enable automations',
    desc: 'Cart recovery, COD verify, order updates — all pre-built. Toggle on. Done.',
    icon: Package,
    accent: '#3b82f6',
  },
  {
    num: '03',
    title: 'Watch revenue roll in',
    desc: 'Wapaci sends every message at exactly the right time. You just watch the dashboard.',
    icon: TrendingUp,
    accent: '#a855f7',
  },
]

function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="how-it-works" ref={ref} className="bg-[#030812] py-24">
      <div className="max-w-5xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Live in 10 minutes. Not kidding.
          </h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">
            No developer. No complicated API setup. No onboarding calls. Just connect and go.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15 * i }}
              className="text-center"
            >
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
                style={{ background: `${s.accent}20`, border: `1px solid ${s.accent}30` }}
              >
                <s.icon className="w-6 h-6" style={{ color: s.accent }} />
              </div>
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

// ─── FINAL CTA ─────────────────────────────────────────────────────────────
function FinalCTA() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#25D366]/8 rounded-full blur-3xl pointer-events-none"
      />
      <div className="max-w-3xl mx-auto px-5 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex items-center justify-center w-16 h-16 bg-[#25D366]/15 border border-[#25D366]/40 rounded-2xl mb-8 shadow-xl shadow-green-500/20"
        >
          <MessageCircle className="w-8 h-8 text-[#25D366]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl md:text-5xl font-extrabold text-white leading-tight"
        >
          Every day without Wapaci is<br />
          <span className="text-red-400">revenue you're walking away from.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-slate-400 text-lg leading-relaxed"
        >
          340+ D2C brands are recovering abandoned carts, slashing RTOs, and building loyal customers on WhatsApp right now. You're next.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup?utm_source=facebook&utm_campaign=ecom-lp"
            className="group inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-2xl shadow-green-500/40 hover:shadow-green-500/60 hover:scale-[1.03] active:scale-[0.98]"
          >
            Start your 7-day free trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Cancel anytime</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6"
        >
          {[
            '🔒 WhatsApp Business API',
            '🇮🇳 Built for Indian D2C',
            '⚡ Setup in 10 minutes',
            '✅ No developer needed',
          ].map(b => (
            <span key={b} className="text-slate-500 text-sm">{b}</span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── MINIMAL FOOTER ────────────────────────────────────────────────────────
function EcomFooter() {
  return (
    <footer className="bg-[#070b12] border-t border-white/5 py-8">
      <div className="max-w-5xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center group-hover:scale-105 transition">
            <MessageCircle className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Wapaci</span>
        </Link>
        <div className="flex items-center gap-4 text-slate-500 text-xs">
          <Link href="/privacy-policy" className="hover:text-slate-300 transition">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-slate-300 transition">Terms</Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-slate-300 transition">Contact</Link>
          <span>·</span>
          <span>© {new Date().getFullYear()} Wapaci</span>
        </div>
      </div>
    </footer>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function EcomLanding() {
  return (
    <>
      <AuroraBg />
      <main className="antialiased relative" style={{ zIndex: 1 }}>
        <ScrollProgress />
        <EcomHeader />
        <EcomHero />
        <StatsBar />
        <ProblemSection />
        <FeaturesSection />
        <TheMath />
        <Testimonials />
        <HowItWorks />
        <FinalCTA />
        <EcomFooter />
      </main>
    </>
  )
}

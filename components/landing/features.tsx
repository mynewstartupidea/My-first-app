'use client'

import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  ShoppingCart, CreditCard, Package, RefreshCw, BarChart3, Star
} from 'lucide-react'

const features = [
  {
    icon: ShoppingCart,
    title: 'Abandoned Cart Recovery',
    desc: 'Automatically follow up with shoppers who left without buying. 30 min, 1 hr, 24 hr sequences.',
    badge: 'For e-commerce',
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.15)',
    border: 'rgba(249,115,22,0.2)',
    stat: 'Up to 35% recovery rate',
  },
  {
    icon: CreditCard,
    title: 'Appointment Reminders',
    desc: 'Automatically remind customers before appointments. Works for clinics, gyms, salons and more.',
    badge: 'For service businesses',
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.2)',
    stat: '60% fewer no-shows',
  },
  {
    icon: Package,
    title: 'Broadcasts & Promotions',
    desc: 'Send offers, announcements and updates to your entire customer list in one click.',
    badge: 'For every business',
    accent: '#25D366',
    glow: 'rgba(37,211,102,0.15)',
    border: 'rgba(37,211,102,0.25)',
    stat: '5x open rate vs email',
  },
  {
    icon: RefreshCw,
    title: 'Re-engagement Campaigns',
    desc: 'Win back dormant customers after 30/60/90 days with personalised messages and offers.',
    badge: 'Retention booster',
    accent: '#a855f7',
    glow: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.2)',
    stat: '2.4x repeat visits',
  },
  {
    icon: Star,
    title: 'Review Collection',
    desc: 'Automatically ask for a Google or Trustpilot review after every purchase or visit.',
    badge: 'Trust builder',
    accent: '#eab308',
    glow: 'rgba(234,179,8,0.15)',
    border: 'rgba(234,179,8,0.2)',
    stat: '4x more reviews',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    desc: 'Track messages sent, delivered, read rates, replies and revenue — one clean dashboard.',
    badge: 'Full visibility',
    accent: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    border: 'rgba(236,72,153,0.2)',
    stat: 'Real-time data',
  },
]

function TiltCard({ children, glow, border }: {
  children: React.ReactNode
  glow: string
  border: string
}) {
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
  const onLeave = () => { mx.set(0); my.set(0) }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX, rotateY,
        transformStyle: 'preserve-3d',
        perspective: 800,
        borderColor: border,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
      whileHover={{ scale: 1.03 }}
      transition={{ scale: { type: 'spring', stiffness: 300, damping: 22 } }}
      className="relative rounded-2xl bg-[#080f1a] overflow-hidden cursor-default group"
    >
      {/* Dynamic spotlight that follows cursor */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glow} 0%, transparent 55%)`,
        }}
      />
      <div style={{ transform: 'translateZ(20px)' }} className="relative p-6 h-full">
        {children}
      </div>
    </motion.div>
  )
}

export default function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="features" ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">

      {/* Ambient top gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(37,211,102,0.05) 0%, transparent 65%)', filter: 'blur(40px)' }}
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, scale: 1.25, filter: 'blur(16px)' }}
          animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Features</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-extrabold text-white leading-tight">
            One platform for every<br />WhatsApp automation
          </h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto text-lg">
            E-commerce stores, clinics, gyms, coaching centres — any business that has customers.
          </p>
        </motion.div>

        {/* 3D tilt grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 60, filter: 'blur(8px)' }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <TiltCard glow={f.glow} border={f.border}>
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${f.accent}20`, border: `1px solid ${f.accent}40` }}
                  >
                    <f.icon className="w-5 h-5" style={{ color: f.accent }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: f.accent }}>{f.badge}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                <div
                  className="mt-5 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit"
                  style={{ color: f.accent, background: `${f.accent}15` }}
                >
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

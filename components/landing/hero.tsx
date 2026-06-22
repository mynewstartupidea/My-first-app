'use client'

import {
  motion, useMotionValue, useSpring, useTransform, useScroll
} from 'framer-motion'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

// Deterministic particles — no Math.random → no hydration mismatch
const particles = [
  { left: '8%',  top: '20%', w: 3, h: 3, dur: 4.5, delay: 0    },
  { left: '20%', top: '68%', w: 2, h: 2, dur: 5.8, delay: 0.9  },
  { left: '70%', top: '14%', w: 2, h: 2, dur: 4.0, delay: 1.3  },
  { left: '83%', top: '52%', w: 3, h: 3, dur: 5.2, delay: 0.5  },
  { left: '48%', top: '82%', w: 2, h: 2, dur: 4.7, delay: 1.7  },
  { left: '60%', top: '30%', w: 2, h: 2, dur: 3.6, delay: 1.0  },
  { left: '33%', top: '10%', w: 3, h: 3, dur: 5.0, delay: 0.3  },
  { left: '91%', top: '77%', w: 2, h: 2, dur: 5.5, delay: 1.1  },
]

const words1 = ['Send', 'the', 'right', 'message']
const words2 = ['at', 'the', 'right', 'time.']

function useCountUp(target: number, start: boolean, duration = 1.8): number {
  const [val, setVal] = useState(0)
  const done = useRef(false)
  useEffect(() => {
    if (!start || done.current) return
    done.current = true
    let t0: number | null = null
    const tick = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / (duration * 1000), 1)
      setVal((1 - Math.pow(1 - p, 3)) * target)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [start, target, duration])
  return val
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const [statsStarted, setStatsStarted] = useState(false)

  // Scroll-driven parallax — content drifts up as page scrolls
  const { scrollY } = useScroll()
  const contentY = useTransform(scrollY, [0, 800], [0, -180])
  const gridY     = useTransform(scrollY, [0, 800], [0,  -60])

  // Mouse parallax for blobs
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const blob1X = useSpring(useTransform(rawX, [-1, 1], [-50, 50]), { stiffness: 35, damping: 20 })
  const blob1Y = useSpring(useTransform(rawY, [-1, 1], [-35, 35]), { stiffness: 35, damping: 20 })
  const blob2X = useSpring(useTransform(rawX, [-1, 1], [30, -30]),  { stiffness: 28, damping: 20 })
  const blob2Y = useSpring(useTransform(rawY, [-1, 1], [25, -25]),  { stiffness: 28, damping: 20 })
  const partX  = useSpring(useTransform(rawX, [-1, 1], [-14, 14]), { stiffness: 55, damping: 25 })
  const partY  = useSpring(useTransform(rawY, [-1, 1], [-10, 10]), { stiffness: 55, damping: 25 })

  // 3D tilt on phone mockup
  const tiltX = useSpring(useTransform(rawY, [-1, 1], [8, -8]),  { stiffness: 90, damping: 25 })
  const tiltY = useSpring(useTransform(rawX, [-1, 1], [-8, 8]),  { stiffness: 90, damping: 25 })

  const s1 = useCountUp(8.4, statsStarted, 2.2)
  const s2 = useCountUp(340, statsStarted, 1.8)
  const s3 = useCountUp(98,  statsStarted, 1.4)

  useEffect(() => {
    const t = setTimeout(() => setStatsStarted(true), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      rawX.set(((e.clientX - r.left) / r.width  - 0.5) * 2)
      rawY.set(((e.clientY - r.top)  / r.height - 0.5) * 2)
    }
    const leave = () => { rawX.set(0); rawY.set(0) }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave) }
  }, [rawX, rawY])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-16"
      style={{ background: 'transparent' }}
    >
      {/* ── Background layer ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        {/* 3D grid floor */}
        <motion.div style={{ y: gridY }} className="absolute inset-0">
          <div className="hero-grid" />
        </motion.div>

        {/* Large aurora blobs — hero-specific, mouse-driven */}
        <motion.div
          style={{ x: blob1X, y: blob1Y, background: 'radial-gradient(circle, rgba(37,211,102,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }}
          animate={{ scale: [1, 1.2, 0.95, 1.1, 1], opacity: [0.5, 0.85, 0.6, 0.9, 0.5] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-60 -right-60 w-[900px] h-[900px] rounded-full"
        />
        <motion.div
          style={{ x: blob2X, y: blob2Y, background: 'radial-gradient(circle, rgba(18,140,126,0.15) 0%, transparent 65%)', filter: 'blur(60px)' }}
          animate={{ scale: [1, 1.15, 1.05, 1], opacity: [0.4, 0.7, 0.45, 0.4] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute -bottom-60 -left-60 w-[700px] h-[700px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[550px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(37,211,102,0.06) 0%, transparent 65%)', filter: 'blur(80px)' }}
        />

        {/* Particles */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-[#25D366] pointer-events-none"
            style={{ left: p.left, top: p.top, x: partX, y: partY, width: p.w, height: p.h }}
            animate={{ opacity: [0.15, 0.6, 0.15], scale: [1, 1.5, 1] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}
      </div>

      {/* ── Main content — parallax ── */}
      <motion.div
        className="max-w-6xl mx-auto px-5 py-20 w-full grid lg:grid-cols-2 gap-16 items-center relative"
        style={{ zIndex: 10, y: contentY }}
      >
        {/* Left — copy */}
        <div>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/25 rounded-full px-4 py-1.5 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-[#25D366] text-xs font-bold tracking-widest uppercase">WhatsApp Automation · 340+ businesses</span>
          </motion.div>

          {/* Headline — word by word spring animation */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.0] tracking-tight text-white mb-2">
            <div className="flex flex-wrap gap-x-4 mb-2">
              {words1.map((w, i) => (
                <motion.span
                  key={w}
                  initial={{ opacity: 0, y: 80, rotate: -6, filter: 'blur(12px)', scale: 1.2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)', scale: 1 }}
                  transition={{ type: 'spring', stiffness: 65, damping: 14, delay: 0.06 * i }}
                  className="inline-block"
                >
                  {w}
                </motion.span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4">
              {words2.map((w, i) => (
                <motion.span
                  key={w}
                  initial={{ opacity: 0, y: 80, rotate: i % 2 === 0 ? -5 : 5, filter: 'blur(12px)', scale: 1.2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)', scale: 1 }}
                  transition={{ type: 'spring', stiffness: 65, damping: 14, delay: 0.06 * (words1.length + i) }}
                  className={`inline-block ${i === 1 ? 'text-shimmer' : ''}`}
                >
                  {w}
                </motion.span>
              ))}
            </div>
          </h1>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-6 text-lg md:text-xl text-slate-400 leading-relaxed max-w-lg"
          >
            Appointment reminders, follow-up sequences, promotions and re-engagement — automated on WhatsApp. Works for any business. Sets up in minutes.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mt-9 flex flex-col sm:flex-row gap-3"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-2xl shadow-green-500/40 hover:shadow-green-500/70 hover:scale-[1.04] active:scale-[0.97]"
            >
              Start for free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-slate-300 hover:text-white border border-white/10 hover:border-[#25D366]/40 px-8 py-4 rounded-2xl text-lg transition-all font-semibold bg-white/5 hover:bg-white/8 hover:scale-[1.02] active:scale-[0.98]"
            >
              See how it works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-4 text-slate-600 text-sm"
          >
            No credit card · Free trial · Cancel anytime
          </motion.p>
        </div>

        {/* Right — Phone mockup with 3D entry */}
        <motion.div
          initial={{ opacity: 0, rotateY: 30, z: -80 }}
          animate={{ opacity: 1, rotateY: 0, z: 0 }}
          transition={{ duration: 1.0, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            rotateX: tiltX, rotateY: tiltY,
            transformStyle: 'preserve-3d',
            perspective: '1200px',
          }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="relative w-[340px]">

            {/* Glow halo */}
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.97, 1.06, 0.97] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -inset-6 rounded-[3rem] bg-[#25D366]/20 blur-3xl -z-10"
            />

            {/* Floating badge — top right */}
            <motion.div
              initial={{ opacity: 0, x: 40, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ position: 'absolute', top: '-18px', right: '-28px', zIndex: 20 }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="bg-[#0a1f14] border border-[#25D366]/40 rounded-xl px-3 py-2 shadow-xl shadow-black/50 whitespace-nowrap"
              >
                <p className="text-[#25D366] text-xs font-bold">📅 5 appointments confirmed</p>
                <p className="text-slate-500 text-[10px]">today via WhatsApp</p>
              </motion.div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              initial={{ opacity: 0, x: -40, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 1.8, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ position: 'absolute', bottom: '60px', left: '-32px', zIndex: 20 }}
            >
              <motion.div
                animate={{ y: [0, 7, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="bg-[#0d1520] border border-white/10 rounded-xl px-3 py-2 shadow-xl shadow-black/50 whitespace-nowrap"
              >
                <p className="text-white text-xs font-semibold">💬 14 new replies today</p>
                <p className="text-slate-500 text-[10px]">98% open rate</p>
              </motion.div>
            </motion.div>

            {/* Phone card */}
            <div className="w-full rounded-3xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-[#25D366]/15">
              {/* WhatsApp header */}
              <div className="bg-[#075E54] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center font-bold text-white text-sm">W</div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#075E54]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Wapaci Bot</p>
                    <p className="text-green-200/80 text-xs">Online · replies instantly</p>
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div className="bg-[#0d1821] p-4 space-y-3" style={{ minHeight: 360 }}>
                {[
                  { side: 'left',  text: '📅 Reminder: Your appointment is tomorrow at 3 PM!', delay: 0.3  },
                  { side: 'right', text: '✅ Thanks! I\'ll be there',                        delay: 0.7  },
                  { side: 'left',  text: '🔔 Confirmed! See you at 3 PM, Dr. Sharma',        delay: 1.1  },
                  { side: 'right', text: '❤️ So convenient, love this service!',             delay: 1.5  },
                  { side: 'left',  text: '🎁 Refer a friend — both get 20% off next visit',  delay: 1.9  },
                ].map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: b.side === 'left' ? -20 : 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.4, delay: b.delay }}
                    className={`flex ${b.side === 'right' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm font-medium shadow-md ${b.side === 'left' ? 'bg-white text-slate-800 rounded-tl-sm' : 'bg-[#25D366] text-white rounded-tr-sm'}`}>
                      {b.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Input bar */}
              <div className="bg-[#1a2330] px-4 py-3 flex items-center gap-2">
                <div className="flex-1 bg-[#2a3441] rounded-full px-4 py-2 text-slate-500 text-sm">Reply to customer...</div>
                <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Stats bar — bottom of hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.0 }}
        className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-[#030812]/60 backdrop-blur-sm"
        style={{ zIndex: 10 }}
      >
        <div className="max-w-6xl mx-auto px-5 py-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-white tabular-nums">₹{s1.toFixed(1)}Cr</p>
            <p className="text-slate-500 text-xs mt-0.5">Revenue generated</p>
          </div>
          <div className="border-x border-white/5">
            <p className="text-3xl md:text-4xl font-extrabold text-white tabular-nums">{Math.round(s2)}+</p>
            <p className="text-slate-500 text-xs mt-0.5">Businesses using Wapaci</p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-extrabold text-[#25D366] tabular-nums">{Math.round(s3)}%</p>
            <p className="text-slate-500 text-xs mt-0.5">WhatsApp open rate</p>
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <motion.div
          animate={{ y: [0, 10, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="w-0.5 h-7 bg-gradient-to-b from-[#25D366] to-transparent rounded-full"
        />
      </motion.div>
    </section>
  )
}

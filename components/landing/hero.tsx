'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react'

const bubbles = [
  { side: 'left',  text: '🛒 You left something behind! Your cart is waiting...', delay: 0.3,  top: '18%' },
  { side: 'right', text: '💚 Yes! Complete my order please', delay: 0.7, top: '30%' },
  { side: 'left',  text: '🚀 Your order #4521 has been shipped! Track here →', delay: 1.1, top: '46%' },
  { side: 'right', text: '❤️ Love this brand! So fast!', delay: 1.5, top: '58%' },
  { side: 'left',  text: '🎁 Special offer just for you — 15% off your next order', delay: 1.9, top: '71%' },
]

// Floating particle positions (deterministic, no random — avoids hydration mismatch)
const particles = [
  { left: '8%',  top: '22%', size: 3, dur: 4.2, delay: 0   },
  { left: '18%', top: '65%', size: 2, dur: 5.5, delay: 0.8 },
  { left: '72%', top: '15%', size: 2, dur: 3.8, delay: 1.2 },
  { left: '85%', top: '55%', size: 3, dur: 5.0, delay: 0.4 },
  { left: '45%', top: '80%', size: 2, dur: 4.6, delay: 1.6 },
  { left: '62%', top: '35%', size: 2, dur: 3.5, delay: 0.9 },
  { left: '30%', top: '12%', size: 3, dur: 4.9, delay: 0.2 },
  { left: '92%', top: '75%', size: 2, dur: 5.2, delay: 1.0 },
]

function ChatBubble({ side, text, delay, top }: { side: string; text: string; delay: number; top: string }) {
  const isLeft = side === 'left'
  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -30 : 30, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`absolute ${isLeft ? 'left-0' : 'right-0'} max-w-[75%]`}
      style={{ top }}
    >
      <div className={`
        px-4 py-2.5 rounded-2xl text-sm shadow-lg font-medium
        ${isLeft
          ? 'bg-white text-slate-800 rounded-tl-sm'
          : 'bg-[#25D366] text-white rounded-tr-sm ml-auto'}
      `}>
        {text}
      </div>
      <div className={`text-[10px] mt-1 text-slate-500 ${isLeft ? 'pl-1' : 'text-right pr-1'}`}>
        {isLeft ? 'Wapaci Bot' : 'Customer'} · just now
      </div>
    </motion.div>
  )
}

export default function Hero() {
  // Mouse parallax — useMotionValue avoids React re-renders on every mouse move
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const blob1X = useSpring(useTransform(rawX, [-1, 1], [-35, 35]), { stiffness: 40, damping: 20 })
  const blob1Y = useSpring(useTransform(rawY, [-1, 1], [-25, 25]), { stiffness: 40, damping: 20 })
  const blob2X = useSpring(useTransform(rawX, [-1, 1], [25, -25]), { stiffness: 30, damping: 20 })
  const blob2Y = useSpring(useTransform(rawY, [-1, 1], [20, -20]), { stiffness: 30, damping: 20 })
  const partX  = useSpring(useTransform(rawX, [-1, 1], [-12, 12]), { stiffness: 60, damping: 25 })
  const partY  = useSpring(useTransform(rawY, [-1, 1], [-8,  8]),  { stiffness: 60, damping: 25 })

  // 3D tilt on phone mockup
  const tiltX = useSpring(useTransform(rawY, [-1, 1], [6, -6]),  { stiffness: 80, damping: 25 })
  const tiltY = useSpring(useTransform(rawX, [-1, 1], [-6, 6]),  { stiffness: 80, damping: 25 })

  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const handleMouse = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect()
      rawX.set(((e.clientX - rect.left) / rect.width  - 0.5) * 2)
      rawY.set(((e.clientY - rect.top)  / rect.height - 0.5) * 2)
    }
    const handleLeave = () => { rawX.set(0); rawY.set(0) }
    section.addEventListener('mousemove', handleMouse)
    section.addEventListener('mouseleave', handleLeave)
    return () => {
      section.removeEventListener('mousemove', handleMouse)
      section.removeEventListener('mouseleave', handleLeave)
    }
  }, [rawX, rawY])

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-[#0a0f1a] flex items-center overflow-hidden pt-16">

      {/* ── Background layer ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">

        {/* Blob 1 — top right, mouse-driven + slow infinite float */}
        <motion.div
          style={{ x: blob1X, y: blob1Y }}
          animate={{ scale: [1, 1.15, 0.95, 1], opacity: [0.6, 0.9, 0.7, 0.6] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#25D366]/10 rounded-full blur-3xl"
        />

        {/* Blob 2 — bottom left, opposite mouse direction */}
        <motion.div
          style={{ x: blob2X, y: blob2Y }}
          animate={{ scale: [1, 1.1, 1.2, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[#128C7E]/12 rounded-full blur-3xl"
        />

        {/* Blob 3 — centre, slow pulse */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-[#25D366]/4 rounded-full blur-3xl"
        />

        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%2325D366%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />

        {/* Floating particles — mouse-offset */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-[#25D366] pointer-events-none"
            style={{ left: p.left, top: p.top, x: partX, y: partY, width: p.size, height: p.size }}
            animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.3, 1] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center relative z-10">

        {/* Left — copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full px-4 py-1.5 mb-6"
          >
            <Zap className="w-3.5 h-3.5 text-[#25D366]" />
            <span className="text-[#25D366] text-xs font-semibold tracking-wide uppercase">WhatsApp Automation for Ecommerce Brands</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight"
          >
            Recover Revenue on{' '}
            <span className="relative inline-block">
              {/* Shimmer gradient text */}
              <span className="text-shimmer">WhatsApp</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.9 }}
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-[#25D366]/0 via-[#25D366]/60 to-[#25D366]/0 origin-left rounded-full"
              />
            </span>
            <br />— on autopilot
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-5 text-lg text-slate-400 leading-relaxed max-w-lg"
          >
            Send automated cart recovery, COD verification, shipping updates and upsells via WhatsApp. Built for ecommerce brands — connects to your store in 2 minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-4 flex flex-col gap-2"
          >
            {[
              '98% message open rate vs 20% email',
              'No coding required — plug & play',
              '₹0 setup cost, pay only per message',
            ].map(point => (
              <div key={point} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#25D366] flex-shrink-0" />
                <span className="text-slate-300 text-sm">{point}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8 flex flex-col sm:flex-row gap-3"
          >
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-7 py-3.5 rounded-2xl text-base transition shadow-xl shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.03] active:scale-[0.98] group"
            >
              Start for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-slate-300 hover:text-white border border-white/10 hover:border-[#25D366]/40 px-7 py-3.5 rounded-2xl text-base transition font-semibold bg-white/5 hover:bg-white/8"
            >
              See how it works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-4 text-slate-500 text-xs"
          >
            No credit card required · Free trial · Cancel anytime
          </motion.p>
        </div>

        {/* Right — WhatsApp chat mockup with 3D tilt */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d', perspective: '1200px' }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="relative w-[340px]">
            {/* Glow halo behind phone */}
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.98, 1.04, 0.98] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-3xl bg-[#25D366]/15 blur-2xl -z-10"
            />

            <div className="w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10 ring-1 ring-[#25D366]/10">
              {/* Phone status bar */}
              <div className="bg-[#075E54] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                      W
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#075E54]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Wapaci Bot</p>
                    <p className="text-green-200 text-xs">Online · typically replies instantly</p>
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div
                className="bg-[#0d1821] relative"
                style={{
                  minHeight: 420,
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg opacity='0.03' xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cpath fill='%2325D366' d='M0 0h40v40H0zm40 40h40v40H40z'/%3E%3C/svg%3E\")",
                }}
              >
                <div className="relative p-4" style={{ minHeight: 420 }}>
                  {bubbles.map((b, i) => (
                    <ChatBubble key={i} {...b} />
                  ))}
                </div>
              </div>

              {/* Input area */}
              <div className="bg-[#1a2330] px-4 py-3 flex items-center gap-2">
                <div className="flex-1 bg-[#2a3441] rounded-full px-4 py-2 text-slate-500 text-sm">
                  Reply to customer...
                </div>
                <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-green-500/30">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <span className="text-slate-600 text-xs tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-0.5 h-6 bg-gradient-to-b from-[#25D366] to-transparent rounded-full"
        />
      </motion.div>
    </section>
  )
}

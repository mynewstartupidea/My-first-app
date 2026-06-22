'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

export default function CtaSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">

      {/* Large animated glow blob */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-[#25D366]/6 rounded-full blur-2xl pointer-events-none"
      />

      <div className="max-w-3xl mx-auto px-5 text-center relative z-10">

        {/* Icon with pulsing rings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative inline-flex items-center justify-center mb-8"
        >
          {/* Outer ring — slow */}
          <span
            className="absolute w-24 h-24 rounded-full border border-[#25D366]/25 animate-pulse-ring-slow"
            style={{ animationPlayState: inView ? 'running' : 'paused' }}
          />
          {/* Inner ring */}
          <span
            className="absolute w-20 h-20 rounded-full border border-[#25D366]/40 animate-pulse-ring"
            style={{ animationPlayState: inView ? 'running' : 'paused' }}
          />
          {/* Icon box */}
          <div className="relative w-16 h-16 bg-[#25D366]/15 border border-[#25D366]/40 rounded-2xl flex items-center justify-center shadow-xl shadow-green-500/20">
            <MessageCircle className="w-8 h-8 text-[#25D366]" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-3xl md:text-5xl font-extrabold text-white leading-tight"
        >
          Ready to grow your business on{' '}
          <span className="text-[#25D366]">WhatsApp?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-5 text-slate-400 text-lg leading-relaxed"
        >
          Join 340+ businesses already growing with Wapaci. Works for clinics, gyms, coaches, retailers and more. Setup in under 10 minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-2xl shadow-green-500/40 hover:shadow-green-500/60 hover:scale-[1.03] active:scale-[0.98]"
          >
            Start for free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-150" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Free trial · Cancel anytime</p>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6"
        >
          {[
            '🔒 End-to-end encrypted',
            '🇮🇳 Made for Indian businesses',
            '✅ WhatsApp Business API',
            '⚡ 99.9% uptime',
          ].map(badge => (
            <span key={badge} className="text-slate-500 text-sm">{badge}</span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

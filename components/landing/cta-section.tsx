'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

export default function CtaSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#25D366]/8 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-5 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="w-16 h-16 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl flex items-center justify-center mx-auto mb-6"
        >
          <MessageCircle className="w-8 h-8 text-[#25D366]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl md:text-5xl font-extrabold text-white leading-tight"
        >
          Ready to recover revenue on{' '}
          <span className="text-[#25D366]">autopilot?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-slate-400 text-lg leading-relaxed"
        >
          Join 100+ Indian D2C brands already using Wapaci. Setup takes less than 10 minutes. No dev help needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-4 rounded-2xl text-lg transition shadow-2xl shadow-green-500/30 group"
          >
            Start for free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </Link>
          <p className="text-slate-500 text-sm">No credit card · Free trial · Cancel anytime</p>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6"
        >
          {[
            '🔒 End-to-end encrypted',
            '🇮🇳 Made for Indian brands',
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

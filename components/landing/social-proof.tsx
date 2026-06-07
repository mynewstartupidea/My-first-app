'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Rahul Mehta',
    role: 'Founder, KidsCraft India',
    avatar: 'RM',
    color: 'bg-orange-500',
    quote: 'Recovered ₹2.1L in the very first month — just from abandoned cart recovery. Setup took 7 minutes and automations were live the same day.',
    stars: 5,
    metric: '₹2.1L recovered in month 1',
  },
  {
    name: 'Priya Kapoor',
    role: 'Co-founder, GlowUp Skincare',
    avatar: 'PK',
    color: 'bg-pink-500',
    quote: 'Our RTO rate dropped from 28% to 11% after enabling COD verification. That single automation saves us lakhs every month. Wish we had this earlier.',
    stars: 5,
    metric: 'RTO cut from 28% → 11%',
  },
  {
    name: 'Arjun Singh',
    role: 'CEO, FitLife Supplements',
    avatar: 'AS',
    color: 'bg-blue-500',
    quote: 'We went live in under 10 minutes. Wapaci sent the first cart recovery message that evening. By next morning, 3 customers had already come back and purchased.',
    stars: 5,
    metric: '10 min setup, sales by evening',
  },
]

const stats = [
  { value: '1.2M+', label: 'WhatsApp messages sent' },
  { value: '340+', label: 'Ecommerce brands' },
  { value: '34%', label: 'Average cart recovery rate' },
  { value: '₹8.4Cr', label: 'Revenue recovered for brands' },
]

export default function SocialProof() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="bg-[#0a0f1a] py-24">
      <div className="max-w-6xl mx-auto px-5">
        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-extrabold text-white">{s.value}</p>
              <p className="text-slate-500 text-sm mt-1">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What brands say</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Real results from real brands
          </h2>
        </motion.div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i + 0.3 }}
              className="bg-white/3 border border-white/8 rounded-2xl p-6 flex flex-col"
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                ))}
              </div>

              {/* Quote */}
              <Quote className="w-6 h-6 text-[#25D366]/30 mb-3 flex-shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed flex-1">{t.quote}</p>

              {/* Metric badge */}
              <div className="mt-4 mb-5 inline-block">
                <span className="bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full">
                  {t.metric}
                </span>
              </div>

              {/* Author */}
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

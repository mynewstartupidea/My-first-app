'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { Star, Quote } from 'lucide-react'

function useCountUp(target: number, inView: boolean, duration = 1.8): number {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let t0: number | null = null
    const tick = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / (duration * 1000), 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(e * target)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target, duration])
  return val
}

const testimonials = [
  {
    name: 'Rahul Mehta',
    role: 'Founder, KidsCraft India (D2C)',
    avatar: 'RM',
    color: 'bg-orange-500',
    quote: 'Recovered ₹2.1L in the very first month just from cart recovery. Setup took 7 minutes and automations were live the same evening.',
    stars: 5,
    metric: '₹2.1L recovered in month 1',
  },
  {
    name: 'Dr. Priya Sharma',
    role: 'Owner, Smile Dental Clinic',
    avatar: 'PS',
    color: 'bg-blue-500',
    quote: 'Our appointment no-shows dropped by 65% in the first month. Patients love the WhatsApp reminders — they feel cared for. Setup took 8 minutes.',
    stars: 5,
    metric: '65% fewer no-shows',
  },
  {
    name: 'Rohit Mehra',
    role: 'Founder, Iron Republic Gym',
    avatar: 'RH',
    color: 'bg-pink-500',
    quote: 'Ran a win-back campaign and re-engaged 140 dormant members in 3 days. Revenue jumped that week. This thing pays for itself in hours.',
    stars: 5,
    metric: '140 members re-engaged',
  },
]

const statsConfig = [
  { prefix: '',  target: 1.2, suffix: 'M+', decimals: 1, label: 'WhatsApp messages sent' },
  { prefix: '',  target: 340, suffix: '+',  decimals: 0, label: 'Businesses on Wapaci' },
  { prefix: '',  target: 65,  suffix: '%',  decimals: 0, label: 'Avg reduction in no-shows' },
  { prefix: '₹', target: 8.4, suffix: 'Cr', decimals: 1, label: 'Revenue generated for customers' },
]

export default function SocialProof() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const v0 = useCountUp(statsConfig[0].target, inView, 2)
  const v1 = useCountUp(statsConfig[1].target, inView, 2)
  const v2 = useCountUp(statsConfig[2].target, inView, 2)
  const v3 = useCountUp(statsConfig[3].target, inView, 2)
  const vals = [v0, v1, v2, v3]

  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">

      {/* Ambient glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-[#25D366]/4 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-purple-500/3 rounded-full blur-3xl" />
      </motion.div>

      <div className="max-w-6xl mx-auto px-5 relative z-10">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {statsConfig.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.55, delay: 0.1 * i }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-extrabold text-white tabular-nums">
                {s.prefix}{vals[i].toFixed(s.decimals)}{s.suffix}
              </p>
              <p className="text-slate-500 text-sm mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, scale: 1.2, filter: 'blur(16px)' }}
          animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">What people say</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Real results from real businesses
          </h2>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40, filter: 'blur(6px)', scale: 0.96 }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 } : {}}
              transition={{ duration: 0.55, delay: 0.1 * i + 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="group bg-white/[0.03] border border-white/[0.08] hover:border-[#25D366]/20 rounded-2xl p-6 flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                ))}
              </div>

              <Quote className="w-6 h-6 text-[#25D366]/30 mb-3 flex-shrink-0 group-hover:text-[#25D366]/50 transition-colors duration-200" />
              <p className="text-slate-300 text-sm leading-relaxed flex-1">{t.quote}</p>

              <div className="mt-4 mb-5">
                <span className="bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full group-hover:bg-[#25D366]/15 transition-colors duration-200">
                  {t.metric}
                </span>
              </div>

              <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
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

'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { Mail, MessageSquare, Phone } from 'lucide-react'

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

const channels = [
  {
    icon: Mail,
    name: 'Email',
    open: '20%',
    response: '24-48 hrs',
    spam: 'Often',
    color: 'from-slate-600/20 to-slate-700/10',
    border: 'border-slate-600/30',
    badge: 'bg-red-500/20 text-red-400',
    badgeText: 'Low impact',
  },
  {
    icon: Phone,
    name: 'SMS',
    open: '45%',
    response: '6-12 hrs',
    spam: 'Sometimes',
    color: 'from-blue-600/20 to-blue-700/10',
    border: 'border-blue-600/30',
    badge: 'bg-yellow-500/20 text-yellow-400',
    badgeText: 'Moderate',
  },
  {
    icon: MessageSquare,
    name: 'WhatsApp',
    open: '98%',
    response: '< 5 min',
    spam: 'Never',
    color: 'from-[#25D366]/20 to-[#128C7E]/10',
    border: 'border-[#25D366]/40',
    badge: 'bg-[#25D366]/20 text-[#25D366]',
    badgeText: 'Best channel',
    highlight: true,
  },
]

const stats = [
  { prefix: '₹', target: 2.3, suffix: ' Cr', decimals: 1, label: 'Average revenue lost to abandoned carts per brand per year' },
  { prefix: '',  target: 68,  suffix: '%',   decimals: 0, label: 'Of Indian shoppers abandon carts before checkout' },
  { prefix: '',  target: 3,   suffix: 'x',   decimals: 0, label: 'Higher recovery rate via WhatsApp vs email' },
]

export default function Problem() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const s0 = useCountUp(stats[0].target, inView, 2)
  const s1 = useCountUp(stats[1].target, inView, 2)
  const s2 = useCountUp(stats[2].target, inView, 1.4)

  const vals = [s0, s1, s2]

  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">
      {/* Section divider glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[#25D366]/30 to-transparent" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 1.5 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-[#25D366]/3 rounded-full blur-3xl"
        />
      </div>

      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, scale: 1.2, filter: 'blur(16px)' }}
          animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">The Problem</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Your customers are on WhatsApp.<br />
            <span className="text-slate-400">Your brand isn&apos;t.</span>
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            Indian shoppers check WhatsApp 20+ times a day. Yet most brands still rely on email that goes to spam.
          </p>
        </motion.div>

        {/* Channel comparison */}
        <div className="grid md:grid-cols-3 gap-4 mb-16">
          {channels.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 40, filter: 'blur(6px)', scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 } : {}}
              transition={{ duration: 0.55, delay: 0.12 * i, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -3, scale: 1.02 }}
              className={`
                relative rounded-2xl border p-6 transition-shadow duration-300
                bg-gradient-to-b ${c.color} ${c.border}
                ${c.highlight ? 'ring-1 ring-[#25D366]/40 shadow-2xl shadow-green-500/15 hover:shadow-green-500/25' : 'hover:shadow-xl hover:shadow-white/5'}
              `}
            >
              {c.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                  Wapaci uses this
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.highlight ? 'bg-[#25D366]/20' : 'bg-white/5'}`}>
                <c.icon className={`w-5 h-5 ${c.highlight ? 'text-[#25D366]' : 'text-slate-400'}`} />
              </div>
              <h3 className={`text-xl font-bold mb-5 ${c.highlight ? 'text-white' : 'text-slate-300'}`}>{c.name}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Open rate</span>
                  <span className={`font-bold text-sm ${c.highlight ? 'text-[#25D366]' : 'text-slate-300'}`}>{c.open}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Avg response</span>
                  <span className={`font-bold text-sm ${c.highlight ? 'text-white' : 'text-slate-300'}`}>{c.response}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Goes to spam</span>
                  <span className={`font-bold text-sm ${c.open === '98%' ? 'text-[#25D366]' : 'text-red-400'}`}>{c.spam}</span>
                </div>
              </div>
              <div className={`mt-5 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${c.badge}`}>
                {c.badgeText}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats with count-up */}
        <div className="grid md:grid-cols-3 gap-6 border-t border-white/5 pt-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.5, delay: 0.3 + 0.1 * i }}
              className="text-center"
            >
              <p className="text-4xl md:text-5xl font-extrabold text-[#25D366] tabular-nums">
                {s.prefix}{vals[i].toFixed(s.decimals)}{s.suffix}
              </p>
              <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

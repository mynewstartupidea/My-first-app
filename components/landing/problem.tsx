'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Mail, MessageSquare, Phone } from 'lucide-react'

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
  { value: '₹2.3 Cr', label: 'Average revenue lost to abandoned carts per brand per year' },
  { value: '68%', label: 'Of Indian shoppers abandon carts before checkout' },
  { value: '3x', label: 'Higher recovery rate via WhatsApp vs email' },
]

export default function Problem() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[#25D366]/30 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
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
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className={`
                relative rounded-2xl border p-6
                bg-gradient-to-b ${c.color} ${c.border}
                ${c.highlight ? 'ring-1 ring-[#25D366]/40 shadow-xl shadow-green-500/10' : ''}
              `}
            >
              {c.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
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

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 border-t border-white/5 pt-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.value}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + 0.1 * i }}
              className="text-center"
            >
              <p className="text-4xl font-extrabold text-[#25D366]">{s.value}</p>
              <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

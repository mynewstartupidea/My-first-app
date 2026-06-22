'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  ShoppingCart, CreditCard, Package, RefreshCw,
  BarChart3, Star, ArrowUpRight
} from 'lucide-react'

const features = [
  {
    icon: ShoppingCart,
    title: 'Abandoned Cart Recovery',
    desc: 'Automatically message customers who left without buying. Customizable delays — 30 min, 1 hr, 24 hr sequences.',
    badge: 'Most popular',
    color: 'from-orange-500/10 to-orange-600/5',
    border: 'border-orange-500/20',
    accent: 'text-orange-400',
    glow: 'hover:shadow-orange-500/20',
    stat: 'Up to 35% recovery rate',
  },
  {
    icon: CreditCard,
    title: 'COD Verification',
    desc: 'Confirm Cash-on-Delivery orders before dispatch. Reduce RTO losses by filtering fake orders instantly.',
    badge: 'RTO saver',
    color: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/20',
    accent: 'text-blue-400',
    glow: 'hover:shadow-blue-500/20',
    stat: 'Cut RTO by 40%+',
  },
  {
    icon: Package,
    title: 'Order & Shipping Updates',
    desc: 'Keep customers informed at every step — order confirmed, shipped, out for delivery, delivered.',
    badge: 'CSAT booster',
    color: 'from-[#25D366]/10 to-[#128C7E]/5',
    border: 'border-[#25D366]/20',
    accent: 'text-[#25D366]',
    glow: 'hover:shadow-green-500/20',
    stat: '90%+ customer satisfaction',
  },
  {
    icon: RefreshCw,
    title: 'Win-back Campaigns',
    desc: 'Re-engage customers who haven\'t bought in 30/60/90 days with personalised discount messages.',
    badge: 'Revenue driver',
    color: 'from-purple-500/10 to-purple-600/5',
    border: 'border-purple-500/20',
    accent: 'text-purple-400',
    glow: 'hover:shadow-purple-500/20',
    stat: '2.4x repeat purchases',
  },
  {
    icon: Star,
    title: 'Review Requests',
    desc: 'Auto-send review requests after delivery. Build social proof on Google, Trustpilot, or your own site.',
    badge: 'Trust builder',
    color: 'from-yellow-500/10 to-yellow-600/5',
    border: 'border-yellow-500/20',
    accent: 'text-yellow-400',
    glow: 'hover:shadow-yellow-500/20',
    stat: '4x more reviews',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics Dashboard',
    desc: 'Track messages sent, delivered, read rates and revenue recovered in one clean dashboard.',
    badge: 'Full visibility',
    color: 'from-pink-500/10 to-pink-600/5',
    border: 'border-pink-500/20',
    accent: 'text-pink-400',
    glow: 'hover:shadow-pink-500/20',
    stat: 'Real-time data',
  },
]

export default function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="features" ref={ref} className="bg-[#0a0f1a] py-24 relative overflow-hidden">

      {/* Ambient gradient that anchors the section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#25D366]/4 rounded-full blur-3xl pointer-events-none"
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Features</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Everything you need to grow on WhatsApp
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            One platform. All your WhatsApp automations. Set up once, earn on autopilot.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40, filter: 'blur(6px)', scale: 0.96 }}
              animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 } : {}}
              transition={{ duration: 0.55, delay: 0.08 * i, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`
                group relative rounded-2xl border p-6 cursor-default
                bg-gradient-to-b ${f.color} ${f.border}
                hover:shadow-xl ${f.glow}
                transition-shadow duration-300
              `}
            >
              {/* Hover glow inset */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/[0.02]" />

              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-b ${f.color} border ${f.border} group-hover:scale-110 transition-transform duration-200`}>
                  <f.icon className={`w-5 h-5 ${f.accent}`} />
                </div>
                <ArrowUpRight className={`w-4 h-4 ${f.accent} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200`} />
              </div>

              <span className={`text-xs font-bold uppercase tracking-wide ${f.accent}`}>{f.badge}</span>
              <h3 className="mt-1 text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>

              <div className={`mt-4 text-xs font-semibold ${f.accent} bg-white/5 px-3 py-1.5 rounded-lg w-fit group-hover:bg-white/10 transition-colors duration-200`}>
                {f.stat}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

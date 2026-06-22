'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Store, Zap, MessageCircle, TrendingUp } from 'lucide-react'

const steps = [
  {
    icon: Store,
    step: '01',
    title: 'Connect your ecommerce store',
    desc: 'Connect your store (Shopify, WooCommerce, or other platforms) and authorize with one click. No code, no developer needed.',
    detail: 'Takes ~2 minutes',
    color: 'bg-blue-500/10 border-blue-500/30',
    iconBg: 'bg-blue-500/15',
    accent: 'text-blue-400',
    dot: 'bg-blue-400',
    glow: 'hover:shadow-blue-500/20',
  },
  {
    icon: Zap,
    step: '02',
    title: 'Configure your automations',
    desc: 'Choose which triggers to enable — cart recovery, COD verify, shipping updates, win-backs. Customize the messages.',
    detail: 'Pre-built templates ready',
    color: 'bg-yellow-500/10 border-yellow-500/30',
    iconBg: 'bg-yellow-500/15',
    accent: 'text-yellow-400',
    dot: 'bg-yellow-400',
    glow: 'hover:shadow-yellow-500/20',
  },
  {
    icon: MessageCircle,
    step: '03',
    title: 'Wapaci sends the messages',
    desc: 'When a customer triggers a rule, Wapaci automatically sends the right WhatsApp message at the right time.',
    detail: '24/7 automated delivery',
    color: 'bg-[#25D366]/10 border-[#25D366]/30',
    iconBg: 'bg-[#25D366]/15',
    accent: 'text-[#25D366]',
    dot: 'bg-[#25D366]',
    glow: 'hover:shadow-green-500/20',
  },
  {
    icon: TrendingUp,
    step: '04',
    title: 'Watch revenue recover',
    desc: 'Track every message, click, and conversion in your dashboard. See exactly how much revenue Wapaci recovered.',
    detail: 'Real-time analytics',
    color: 'bg-purple-500/10 border-purple-500/30',
    iconBg: 'bg-purple-500/15',
    accent: 'text-purple-400',
    dot: 'bg-purple-400',
    glow: 'hover:shadow-purple-500/20',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="how-it-works" ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">
      <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-[#25D366]/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, scale: 1.2, filter: 'blur(16px)' }}
          animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Live in 10 minutes. Revenue on day one.
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            No technical setup, no WhatsApp API complexity. We handle everything.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line — draws itself left→right on scroll */}
          <div className="hidden lg:block absolute top-[1.85rem] left-[calc(12.5%+1.25rem)] right-[calc(12.5%+1.25rem)] h-px bg-white/5 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.1, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ transformOrigin: 'left', height: '100%' }}
              className="bg-gradient-to-r from-blue-400/60 via-[#25D366]/60 to-purple-400/60"
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 40, filter: 'blur(6px)', scale: 0.96 }}
                animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 } : {}}
                transition={{ duration: 0.55, delay: 0.15 * i + 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="relative"
              >
                {/* Timeline dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={inView ? { scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.15 * i + 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  className={`hidden lg:flex absolute -top-[3px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full ${s.dot} shadow-sm z-10`}
                />

                <div className={`h-full rounded-2xl border p-6 ${s.color} hover:shadow-xl ${s.glow} transition-all duration-300 group`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                      <s.icon className={`w-5 h-5 ${s.accent}`} />
                    </div>
                    <span className="text-3xl font-black text-white/5">{s.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                  <div className={`mt-4 text-xs font-semibold ${s.accent}`}>{s.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

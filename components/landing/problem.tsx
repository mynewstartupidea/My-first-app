'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { Check } from 'lucide-react'

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
      setVal((1 - Math.pow(1 - p, 3)) * target)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target, duration])
  return val
}

// Fake Gmail promotional emails — relatable for every Indian user
const fakeEmails = [
  { from: 'Zomato',    subject: 'Order now — 50% off on your next meal 🍕',      time: '2d ago',  read: false },
  { from: 'Amazon',    subject: 'Your Great Indian Festival deals end tonight',   time: '3d ago',  read: false },
  { from: 'YOUR BIZ',  subject: 'We miss you! Here\'s a special offer for you…', time: '5d ago',  read: false, highlight: true },
  { from: 'Swiggy',    subject: 'Hungry? Your favourite place is open 🛵',        time: '6d ago',  read: false },
  { from: 'Flipkart',  subject: 'Big Billion Days — up to 80% off',              time: '1w ago',  read: false },
  { from: 'Myntra',    subject: 'End of Reason Sale starts in 2 hours!',         time: '1w ago',  read: false },
]

const metrics = [
  { label: 'Open rate',           email: '20%',     wa: '98%',    waGood: true  },
  { label: 'Read within 5 min',   email: '<3%',     wa: '90%',    waGood: true  },
  { label: 'Response rate',       email: '2–3%',    wa: '40%+',   waGood: true  },
  { label: 'Goes to spam',        email: 'Always',  wa: 'Never',  waGood: true  },
]

export default function Problem() {
  const ref     = useRef(null)
  const inView  = useInView(ref, { once: true, margin: '-80px' })

  const v0 = useCountUp(20,  inView, 1.8)
  const v1 = useCountUp(98,  inView, 1.8)
  const v2 = useCountUp(5,   inView, 1.2)

  return (
    <section ref={ref} className="bg-[#030812] py-28 relative overflow-hidden">

      {/* Section top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[#25D366]/30 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-5">

        {/* ── Heading ── */}
        <motion.div
          initial={{ opacity: 0, scale: 1.15, filter: 'blur(16px)' }}
          animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Why WhatsApp?</span>
          <h2 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08]">
            Email is getting ignored.<br />
            <span className="text-[#25D366]">WhatsApp gets read.</span>
          </h2>
          <p className="mt-5 text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Your last email is buried in 847 unread promotions. Your WhatsApp message? Opened in 4 minutes. The channel you use changes everything.
          </p>
        </motion.div>

        {/* ── Email vs WhatsApp visual battle ── */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 items-start mb-16">

          {/* LEFT — Gmail graveyard */}
          <motion.div
            initial={{ opacity: 0, x: -50, filter: 'blur(8px)' }}
            animate={inView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="rounded-2xl overflow-hidden border border-red-500/20 shadow-xl shadow-red-500/5">
              {/* Browser chrome */}
              <div className="bg-[#1c1c1e] px-4 py-2.5 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/30" />
                </div>
                <div className="flex-1 mx-3 bg-[#2a2a2e] rounded px-3 py-1">
                  <p className="text-slate-500 text-xs">mail.google.com — Promotions</p>
                </div>
              </div>

              {/* Gmail tab row */}
              <div className="bg-[#18181b] flex border-b border-white/5 text-xs">
                <div className="px-4 py-2.5 text-slate-500 border-r border-white/5">Primary</div>
                <div className="px-4 py-2.5 text-slate-500 border-r border-white/5">Social</div>
                <div className="px-4 py-2.5 text-slate-300 border-b-2 border-red-400 flex items-center gap-1.5">
                  Promotions
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">847</span>
                </div>
              </div>

              {/* Email list */}
              <div className="bg-[#111114]">
                {fakeEmails.map((e, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.35, delay: 0.3 + i * 0.07 }}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] ${e.highlight ? 'bg-red-500/5' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${e.highlight ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                      {e.from[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${e.highlight ? 'text-red-400' : 'text-slate-500'}`}>
                        {e.from}{e.highlight && ' ← your message'}
                      </p>
                      <p className="text-xs text-slate-600 truncate">{e.subject}</p>
                    </div>
                    <span className="text-slate-700 text-[11px] whitespace-nowrap">{e.time}</span>
                  </motion.div>
                ))}
                <div className="px-4 py-3 text-center text-slate-700 text-xs">841 more promotional emails…</div>
              </div>
            </div>

            {/* Email verdict */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-4 text-center"
            >
              <p className="text-slate-600 text-sm line-through">Email open rate</p>
              <p className="text-5xl font-extrabold text-slate-600 tabular-nums mt-1">{Math.round(v0)}%</p>
              <p className="text-red-400/70 text-xs mt-1">if it even made it out of spam</p>
            </motion.div>
          </motion.div>

          {/* CENTRE — VS divider */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="hidden lg:flex flex-col items-center gap-3 pt-32"
          >
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-white/40 text-xs font-black">VS</span>
            </div>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          </motion.div>

          {/* RIGHT — WhatsApp winner */}
          <motion.div
            initial={{ opacity: 0, x: 50, filter: 'blur(8px)' }}
            animate={inView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="rounded-2xl overflow-hidden border border-[#25D366]/25 shadow-xl shadow-green-500/10">
              {/* Phone status bar */}
              <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0">W</div>
                <div>
                  <p className="text-white font-semibold text-sm">Wapaci Bot</p>
                  <p className="text-green-200/70 text-xs">Online · replies instantly</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-200/60 text-[11px]">live</span>
                </div>
              </div>

              {/* Chat */}
              <div className="bg-[#0d1821] p-4 space-y-3" style={{ minHeight: 300 }}>
                {[
                  { side: 'left',  text: '👋 Hi! Just a reminder — your appointment is tomorrow at 3 PM.', delay: 0.4, time: '10:02 AM' },
                  { side: 'right', text: 'Thanks! I\'ll be there ✅', delay: 0.7, time: '10:06 AM' },
                  { side: 'left',  text: '🛒 You left something in your cart. Want me to hold it for you?', delay: 1.0, time: '2:15 PM' },
                  { side: 'right', text: 'Yes! Complete my order please 💚', delay: 1.3, time: '2:19 PM' },
                ].map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: b.side === 'left' ? -16 : 16, scale: 0.95 }}
                    animate={inView ? { opacity: 1, x: 0, scale: 1 } : {}}
                    transition={{ duration: 0.35, delay: b.delay }}
                    className={`flex flex-col ${b.side === 'right' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${b.side === 'left' ? 'bg-white text-slate-800 rounded-tl-sm' : 'bg-[#25D366] text-white rounded-tr-sm'}`}>
                      {b.text}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-slate-600">{b.time}</span>
                      {b.side === 'right' && (
                        <div className="flex -space-x-0.5">
                          <Check className="w-3 h-3 text-[#25D366]" />
                          <Check className="w-3 h-3 text-[#25D366] -ml-1" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.8 }}
                  className="flex items-center gap-1 pl-1"
                >
                  <div className="bg-white/10 rounded-full px-3 py-2 flex gap-1">
                    {[0, 1, 2].map(j => (
                      <motion.div
                        key={j}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                        className="w-1.5 h-1.5 rounded-full bg-slate-400"
                      />
                    ))}
                  </div>
                  <span className="text-slate-600 text-xs ml-1">Customer is typing…</span>
                </motion.div>
              </div>
            </div>

            {/* WhatsApp verdict */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="mt-4 text-center"
            >
              <p className="text-slate-400 text-sm">WhatsApp open rate</p>
              <p className="text-5xl font-extrabold text-[#25D366] tabular-nums mt-1">{Math.round(v1)}%</p>
              <p className="text-[#25D366]/60 text-xs mt-1">read in under {Math.round(v2)} minutes on average</p>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Metrics comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="rounded-2xl border border-white/8 overflow-hidden"
        >
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-white/[0.03] border-b border-white/8 text-xs font-bold uppercase tracking-widest">
            <div className="px-5 py-3.5 text-slate-500">Metric</div>
            <div className="px-5 py-3.5 text-slate-500 border-l border-white/8 text-center">📧 Email</div>
            <div className="px-5 py-3.5 text-[#25D366] border-l border-white/8 text-center">💬 WhatsApp</div>
          </div>

          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.08 }}
              className="grid grid-cols-[1fr_1fr_1fr] border-b border-white/5 last:border-0"
            >
              <div className="px-5 py-4 text-slate-400 text-sm">{m.label}</div>
              <div className="px-5 py-4 text-center border-l border-white/5">
                <span className="text-red-400 font-semibold text-sm line-through decoration-red-500/50">{m.email}</span>
              </div>
              <div className="px-5 py-4 text-center border-l border-white/5 bg-[#25D366]/[0.04]">
                <span className="text-[#25D366] font-bold text-sm">{m.wa}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Bottom pull quote ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="text-center text-slate-500 text-sm mt-10 max-w-lg mx-auto italic"
        >
          &ldquo;WhatsApp is the only channel where you <span className="text-slate-300 not-italic font-semibold">know</span> your message was read.&rdquo;
        </motion.p>

      </div>
    </section>
  )
}

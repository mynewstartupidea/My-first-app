'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const scenarios = [
  {
    label: 'Cart Recovery',
    title: 'Turn abandoned carts into sales',
    desc: 'A customer adds a jacket to their cart but leaves. Wapaci sends a friendly WhatsApp reminder 30 minutes later with the cart link.',
    color: 'bg-orange-500',
    conversation: [
      { type: 'bot', text: '👋 Hi Priya! You left something in your cart at StyleCraft. Your Beige Linen Jacket is still waiting for you 🛒' },
      { type: 'bot', text: 'Here\'s your cart: stylecraft.in/cart/restore → Only 2 pieces left!' },
      { type: 'user', text: 'Oh! I forgot. Can you hold it for me?' },
      { type: 'bot', text: '✅ Your cart is saved! Use code COMEBACK10 for 10% off — valid for next 2 hrs 🎉' },
      { type: 'user', text: 'Amazing! Ordering now thank you!!' },
    ],
  },
  {
    label: 'COD Verification',
    title: 'Confirm COD before dispatch',
    desc: 'Before shipping a Cash on Delivery order, Wapaci verifies the customer is real — cutting fake orders and costly returns.',
    color: 'bg-blue-500',
    conversation: [
      { type: 'bot', text: '📦 Hi Rahul! We received your order #8821 for Nike Air Max 270 (Size 9, Black) — ₹7,499 COD.' },
      { type: 'bot', text: 'Please confirm this order by replying YES or NO.' },
      { type: 'user', text: 'YES' },
      { type: 'bot', text: '✅ Confirmed! Your order is now being processed. Expected delivery: 3-5 business days.' },
      { type: 'user', text: 'Thanks! When will it ship?' },
      { type: 'bot', text: '🚚 We\'ll send you a tracking link as soon as it ships. Stay tuned!' },
    ],
  },
  {
    label: 'Shipping Update',
    title: 'Keep customers in the loop',
    desc: 'Every order stage triggers a WhatsApp update — from confirmation to delivery. Zero customer anxiety.',
    color: 'bg-[#25D366]',
    conversation: [
      { type: 'bot', text: '🎉 Order confirmed! Your GlowUp Vitamin C Serum x2 is being packed.' },
      { type: 'bot', text: '🚀 Shipped! Your order is on the way.\nTrack here: delhivery.com/track/AB1234' },
      { type: 'user', text: 'Great! How long will it take?' },
      { type: 'bot', text: '📍 Out for delivery today! Expected by 6 PM. Stay home! 🏠' },
      { type: 'bot', text: '✅ Delivered! Hope you love it. Mind leaving us a quick review? ⭐' },
    ],
  },
  {
    label: 'Win-back',
    title: 'Re-activate sleeping customers',
    desc: 'Customers who haven\'t bought in 60 days get a personalised WhatsApp offer — bringing them back to purchase again.',
    color: 'bg-purple-500',
    conversation: [
      { type: 'bot', text: '💜 Hey Ankita! We miss you at FitFuel. It\'s been 60 days since your last order.' },
      { type: 'bot', text: 'Here\'s a special deal just for you: 20% off your next order → fitfuel.in/shop\nCode: COMEBACK20 (expires in 48 hrs)' },
      { type: 'user', text: 'Wow 20% off! What\'s new since I was last here?' },
      { type: 'bot', text: '🔥 New arrivals: Mango Protein, Collagen Gummies, Pre-workout Shots — check them out!' },
      { type: 'user', text: 'Ordering the Collagen Gummies rn!!' },
    ],
  },
]

function Bubble({ msg, index }: { msg: { type: string; text: string }; index: number }) {
  const isBot = msg.type === 'bot'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.12 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-2`}
    >
      <div className={`
        max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm
        ${isBot ? 'bg-[#1f2937] text-slate-200 rounded-tl-sm' : 'bg-[#25D366] text-white rounded-tr-sm'}
      `}>
        <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
        <div className={`text-[10px] mt-1 ${isBot ? 'text-slate-500' : 'text-green-200'} flex items-center gap-1 ${isBot ? '' : 'justify-end'}`}>
          {isBot ? 'Wapaci Bot' : 'Customer'}
          {!isBot && <CheckCircle2 className="w-2.5 h-2.5" />}
        </div>
      </div>
    </motion.div>
  )
}

export default function UseCases() {
  const [active, setActive] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const scenario = scenarios[active]

  return (
    <section id="use-cases" ref={ref} className="bg-[#0a0f1a] py-24">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Real conversations</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            See Wapaci in action
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            These aren&apos;t templates — these are the actual messages your customers receive.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {scenarios.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setActive(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                active === i
                  ? 'bg-[#25D366] text-white shadow-lg shadow-green-500/20'
                  : 'text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left: description */}
          <motion.div
            key={active + '_text'}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`w-3 h-8 rounded-full ${scenario.color} mb-5`} />
            <h3 className="text-2xl font-extrabold text-white mb-3">{scenario.title}</h3>
            <p className="text-slate-400 text-base leading-relaxed">{scenario.desc}</p>

            <div className="mt-8 space-y-3">
              {['Fully automated — set once, runs forever', 'Personalised with customer name and order details', 'Sent at the right time, not spammy'].map(point => (
                <div key={point} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#25D366]/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                  </div>
                  <span className="text-slate-300 text-sm">{point}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: chat window */}
          <motion.div
            key={active + '_chat'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              {/* Header */}
              <div className={`${scenario.color === 'bg-[#25D366]' ? 'bg-[#075E54]' : 'bg-[#1a2332]'} px-4 py-3 flex items-center gap-3`}>
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center font-bold text-white text-sm">
                  W
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Wapaci Bot</p>
                  <p className="text-green-300 text-xs">● Online</p>
                </div>
              </div>
              {/* Chat */}
              <div className="bg-[#111827] p-4 min-h-64 max-h-80 overflow-y-auto">
                {scenario.conversation.map((msg, i) => (
                  <Bubble key={i} msg={msg} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

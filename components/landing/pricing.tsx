'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, Zap, Star } from 'lucide-react'

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: '₹999',
    period: '/ month',
    desc: 'Perfect for new businesses getting started with WhatsApp.',
    highlight: false,
    cta: 'Get started',
    messages: '2,000 messages / month',
    features: [
      'Abandoned cart recovery',
      'COD verification',
      'Order & shipping updates',
      '1 business account',
      'Basic analytics dashboard',
      'Email support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '₹2,499',
    period: '/ month',
    desc: 'For growing businesses ready to unlock full automation.',
    highlight: true,
    badge: 'Most popular',
    cta: 'Get started',
    messages: '8,000 messages / month',
    features: [
      'Everything in Starter',
      'Win-back campaigns',
      'Post-purchase upsell',
      'Review request automation',
      'Broadcast campaigns',
      'Advanced analytics',
      'Priority email support',
      'Custom message templates',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    price: '₹5,999',
    period: '/ month',
    desc: 'For high-volume businesses that need maximum scale.',
    highlight: false,
    cta: 'Get started',
    messages: '25,000 messages / month',
    features: [
      'Everything in Growth',
      'Customer segmentation',
      'Dedicated onboarding',
      'WhatsApp API consultation',
      'Priority phone support',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
]

export default function Pricing() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="pricing" ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#25D366]/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Pricing</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            No free tier. No hidden fees. 7-day trial on all plans. Cancel anytime.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className={`relative rounded-3xl border p-7 flex flex-col ${
                plan.highlight
                  ? 'bg-[#25D366] border-[#25D366] shadow-2xl shadow-green-500/20 ring-1 ring-[#25D366]/50'
                  : 'bg-white/3 border-white/8'
              }`}
            >
              {plan.highlight && plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-[#128C7E] text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#128C7E]" /> {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-green-100' : 'text-slate-400'}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-green-100' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <p className={`text-sm mt-2 leading-relaxed ${plan.highlight ? 'text-green-100' : 'text-slate-400'}`}>
                  {plan.desc}
                </p>
              </div>

              <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold mb-6 flex items-center gap-2 ${
                plan.highlight ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-300'
              }`}>
                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                {plan.messages}
              </div>

              <ul className="space-y-3 flex-1 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-green-100' : 'text-[#25D366]'}`} />
                    <span className={plan.highlight ? 'text-green-50' : 'text-slate-300'}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/signup?plan=${plan.key}`}
                className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition group ${
                  plan.highlight
                    ? 'bg-white text-[#128C7E] hover:bg-green-50 shadow-lg'
                    : 'bg-[#25D366] hover:bg-[#1db954] text-white shadow-lg shadow-green-500/20'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-10 space-y-2"
        >
          <p className="text-slate-500 text-sm">All plans include a 7-day free trial. No credit card required to start.</p>
          <p className="text-slate-600 text-xs">
            Questions? <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">Chat with us →</a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

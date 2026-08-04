'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, Zap, Star, Building2 } from 'lucide-react'
import { SHOPIFY_PLANS, TRIAL_DAYS } from '@/lib/shopify-billing'

const PLAN_ICONS = [Zap, Star, Building2, Building2]

export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="pricing" ref={ref} className="bg-[#0d1117] py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Pricing</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base">
            {TRIAL_DAYS}-day free trial on all plans · No setup fees · Cancel anytime
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SHOPIFY_PLANS.map((plan, i) => {
            const Icon = PLAN_ICONS[i]
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
                className={`relative rounded-2xl p-5 flex flex-col ${
                  plan.recommended
                    ? 'bg-[#25D366]/10 border-2 border-[#25D366]/40'
                    : 'bg-white/3 border border-white/8'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${plan.recommended ? 'bg-[#25D366]/20' : 'bg-white/5'}`}>
                  <Icon className={`w-4 h-4 ${plan.recommended ? 'text-[#25D366]' : 'text-slate-400'}`} />
                </div>
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1 mb-1">
                  <span className="text-2xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-slate-500 text-xs">/mo</span>
                </div>
                <p className="text-slate-500 text-xs mb-4">{plan.orders}</p>

                <ul className="space-y-1.5 flex-1 mb-5">
                  <li className="flex items-start gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                    {plan.messages === -1 ? 'Unlimited messages' : `${plan.messages.toLocaleString()} messages/mo`}
                  </li>
                  <li className="flex items-start gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                    WhatsApp automation
                  </li>
                  <li className="flex items-start gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                    Abandoned cart recovery
                  </li>
                </ul>

                <Link
                  href="/signup"
                  className={`inline-flex items-center justify-center gap-1.5 font-semibold py-2 px-3 rounded-xl text-xs transition group ${
                    plan.recommended
                      ? 'bg-[#25D366] hover:bg-[#1db954] text-white'
                      : 'bg-white/8 hover:bg-white/15 text-slate-200'
                  }`}
                >
                  Start free trial
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </Link>
              </motion.div>
            )
          })}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Billing handled securely by Shopify · {TRIAL_DAYS}-day free trial, no charge until trial ends
        </p>
      </div>
    </section>
  )
}

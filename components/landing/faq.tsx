'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Do I need a WhatsApp Business API account?',
    a: 'No. Wapaci is an official Meta Business Partner and manages the WhatsApp Business API directly — no third-party BSP required. Just connect your ecommerce store and you\'re ready to go.',
  },
  {
    q: 'Will my customers receive spam?',
    a: 'Never. All messages are sent only to customers who have opted in via your store\'s checkout or signup flows. We follow WhatsApp\'s strict messaging policies. Your reputation stays intact.',
  },
  {
    q: 'How does pricing work?',
    a: 'You pay per message sent, with a low base platform fee. There are no hidden costs, no setup fees, and no long-term contracts. Start free and scale as you grow.',
  },
  {
    q: 'Which ecommerce platforms does Wapaci work with?',
    a: 'Wapaci works with all major ecommerce platforms — Shopify (all plans including Basic, Advanced, and Plus), WooCommerce, and more integrations coming soon. All you need is a live online store.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most brands go live in under 10 minutes. Connect your ecommerce store, enable the automations you want, and Wapaci handles the rest. No developer required.',
  },
  {
    q: 'Can I customise the message templates?',
    a: 'Yes, fully. Every message template — cart recovery, COD verification, shipping updates, win-back campaigns — can be customised with your brand\'s tone and language, including Hindi and Hinglish.',
  },
  {
    q: 'Is customer data safe?',
    a: 'Absolutely. All data is encrypted in transit and at rest. We never share, sell, or misuse customer data. We are GDPR and Indian data protection compliant.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="faq" ref={ref} className="bg-[#0a0f1a] py-24">
      <div className="max-w-3xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">FAQ</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">
            Frequently asked questions
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="rounded-2xl border border-white/8 overflow-hidden bg-white/3"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/5 transition"
              >
                <span className="text-white font-semibold text-sm md:text-base pr-4">{faq.q}</span>
                <motion.div
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

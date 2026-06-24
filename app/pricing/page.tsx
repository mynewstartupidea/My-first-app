import Link from 'next/link'
import { CheckCircle2, X, Zap, Star, ArrowRight, MessageCircle, Menu } from 'lucide-react'
import Footer from '@/components/landing/footer'
import Navbar from '@/components/landing/navbar'

export const metadata = {
  title: 'Pricing – Wapaci',
  description: 'Simple, transparent WhatsApp marketing pricing. Starter ₹999/mo, Growth ₹2,499/mo, Scale ₹5,999/mo. 7-day free trial. No credit card required.',
}

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: '₹999',
    period: '/ month',
    messages: '2,000 messages / month',
    desc: 'Perfect for new businesses getting started with WhatsApp automation.',
    highlight: false,
    cta: 'Start free trial',
    features: [
      'Abandoned cart recovery',
      'COD order verification',
      'Order & shipping updates',
      '1 WhatsApp business account',
      'Basic analytics dashboard',
      'Email support',
    ],
    notIncluded: [
      'Win-back campaigns',
      'Broadcast campaigns',
      'Customer segmentation',
      'Dedicated onboarding',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '₹2,499',
    period: '/ month',
    messages: '8,000 messages / month',
    desc: 'For growing businesses ready to unlock full WhatsApp automation.',
    highlight: true,
    badge: 'Most popular',
    cta: 'Start free trial',
    features: [
      'Everything in Starter',
      'Win-back campaigns',
      'Post-purchase upsell',
      'Review request automation',
      'Broadcast campaigns',
      'Advanced analytics',
      'Custom message templates',
      'Priority email support',
    ],
    notIncluded: [
      'Customer segmentation',
      'Dedicated onboarding',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    price: '₹5,999',
    period: '/ month',
    messages: '25,000 messages / month',
    desc: 'For high-volume businesses that need maximum scale and support.',
    highlight: false,
    cta: 'Start free trial',
    features: [
      'Everything in Growth',
      'Customer segmentation',
      'Dedicated onboarding session',
      'WhatsApp API consultation',
      'Priority phone support',
      'SLA guarantee',
    ],
    notIncluded: [],
  },
]

const comparison = [
  { feature: 'Messages per month',     starter: '2,000',   growth: '8,000',   scale: '25,000' },
  { feature: 'WhatsApp accounts',       starter: '1',       growth: '1',       scale: '1' },
  { feature: 'Abandoned cart recovery', starter: true,      growth: true,      scale: true },
  { feature: 'COD verification',        starter: true,      growth: true,      scale: true },
  { feature: 'Order & shipping updates',starter: true,      growth: true,      scale: true },
  { feature: 'Win-back campaigns',      starter: false,     growth: true,      scale: true },
  { feature: 'Broadcast campaigns',     starter: false,     growth: true,      scale: true },
  { feature: 'Post-purchase upsell',    starter: false,     growth: true,      scale: true },
  { feature: 'Review request',          starter: false,     growth: true,      scale: true },
  { feature: 'Custom templates',        starter: false,     growth: true,      scale: true },
  { feature: 'Advanced analytics',      starter: false,     growth: true,      scale: true },
  { feature: 'Customer segmentation',   starter: false,     growth: false,     scale: true },
  { feature: 'Dedicated onboarding',    starter: false,     growth: false,     scale: true },
  { feature: 'Priority phone support',  starter: false,     growth: false,     scale: true },
  { feature: 'SLA guarantee',           starter: false,     growth: false,     scale: true },
  { feature: 'Support',                 starter: 'Email',   growth: 'Priority email', scale: 'Phone + email' },
]

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every plan comes with a 7-day free trial. No credit card required to start. You only get charged after the trial ends.',
  },
  {
    q: 'What happens if I go over my message limit?',
    a: 'Automations pause until the next billing cycle. You can upgrade your plan at any time to get more messages immediately.',
  },
  {
    q: 'Can I change plans anytime?',
    a: 'Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades take effect at the next billing date.',
  },
  {
    q: 'What counts as a message?',
    a: 'Each WhatsApp message sent to a customer counts as one message — whether it\'s an abandoned cart reminder, order update, campaign blast, or any other automation.',
  },
  {
    q: 'Do I need a WhatsApp Business API account?',
    a: 'Yes. Wapaci connects to your WhatsApp Business Account via the official Meta API. We walk you through the setup during onboarding — it takes about 10 minutes.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. Cancel from your dashboard settings with one click. No lock-in, no cancellation fees.',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') return <span className="text-slate-300 text-sm">{value}</span>
  return value
    ? <CheckCircle2 className="w-5 h-5 text-[#25D366] mx-auto" />
    : <X className="w-4 h-4 text-slate-600 mx-auto" />
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 text-center px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#25D366]/6 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Pricing</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            No hidden fees. 7-day free trial on every plan. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.key}
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

              <div className="mb-5">
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

              <ul className="space-y-3 flex-1 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-green-100' : 'text-[#25D366]'}`} />
                    <span className={plan.highlight ? 'text-green-50' : 'text-slate-300'}>{f}</span>
                  </li>
                ))}
                {plan.notIncluded.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm opacity-40">
                    <X className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-green-100' : 'text-slate-500'}`} />
                    <span className={plan.highlight ? 'text-green-50' : 'text-slate-400'}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/signup?plan=${plan.key}`}
                className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition group mt-4 ${
                  plan.highlight
                    ? 'bg-white text-[#128C7E] hover:bg-green-50 shadow-lg'
                    : 'bg-[#25D366] hover:bg-[#1db954] text-white shadow-lg shadow-green-500/20'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          All plans include a 7-day free trial · No credit card required · Cancel anytime
        </p>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-5 pb-24">
        <h2 className="text-2xl font-extrabold text-white text-center mb-10">Compare plans</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left py-4 px-6 text-slate-400 font-medium w-1/2">Feature</th>
                <th className="py-4 px-4 text-center text-slate-300 font-semibold">Starter</th>
                <th className="py-4 px-4 text-center text-[#25D366] font-semibold">Growth</th>
                <th className="py-4 px-4 text-center text-slate-300 font-semibold">Scale</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/1' : ''}`}>
                  <td className="py-3.5 px-6 text-slate-400">{row.feature}</td>
                  <td className="py-3.5 px-4 text-center"><Cell value={row.starter} /></td>
                  <td className="py-3.5 px-4 text-center bg-[#25D366]/5"><Cell value={row.growth} /></td>
                  <td className="py-3.5 px-4 text-center"><Cell value={row.scale} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 pb-24">
        <h2 className="text-2xl font-extrabold text-white text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <p className="text-white font-semibold text-sm mb-2">{q}</p>
              <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-5 pb-24 text-center">
        <div className="bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-3xl p-10">
          <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-500/30">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Ready to grow on WhatsApp?</h2>
          <p className="text-slate-400 text-sm mb-7">Start your 7-day free trial. No credit card required.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1db954] text-white font-bold px-8 py-3.5 rounded-2xl transition shadow-lg shadow-green-500/20 group"
          >
            Get started free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
          </Link>
          <p className="text-slate-600 text-xs mt-4">
            Questions? <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">Email us →</a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}

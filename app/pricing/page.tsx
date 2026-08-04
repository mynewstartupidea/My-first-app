import Link from 'next/link'
import { CheckCircle2, ArrowRight, Zap, Star, Building2 } from 'lucide-react'
import Footer from '@/components/landing/footer'
import Navbar from '@/components/landing/navbar'
import { SHOPIFY_PLANS, TRIAL_DAYS } from '@/lib/shopify-billing'

export const metadata = {
  title: 'Pricing - Wapaci',
  description: 'Simple, transparent pricing for Wapaci WhatsApp automation. Plans starting at $29/month with a 7-day free trial.',
}

const PLAN_ICONS = [Zap, Star, Building2, Building2]

const PLAN_FEATURES: Record<string, string[]> = {
  starter:    ['Abandoned cart recovery', 'COD verification', 'Order & shipping updates', 'Campaign broadcasts', 'Analytics dashboard', 'Email & chat support'],
  growth:     ['Abandoned cart recovery', 'COD verification', 'Order & shipping updates', 'Campaign broadcasts', 'Analytics dashboard', 'Email & chat support'],
  scale:      ['Abandoned cart recovery', 'COD verification', 'Order & shipping updates', 'Campaign broadcasts', 'Advanced analytics', 'Priority support'],
  enterprise: ['Abandoned cart recovery', 'COD verification', 'Order & shipping updates', 'Campaign broadcasts', 'Advanced analytics', 'Dedicated account manager'],
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Navbar />

      <section className="pt-32 pb-12 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Pricing</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            {TRIAL_DAYS}-day free trial on all plans · Cancel anytime · Billed by Shopify
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SHOPIFY_PLANS.map((plan, i) => {
            const Icon = PLAN_ICONS[i]
            const features = PLAN_FEATURES[plan.id] ?? []
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 flex flex-col ${
                  plan.recommended
                    ? 'bg-[#25D366]/10 border-2 border-[#25D366]/50'
                    : 'bg-white/3 border border-white/8'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                    Most popular
                  </div>
                )}

                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${plan.recommended ? 'bg-[#25D366]/20' : 'bg-white/5'}`}>
                    <Icon className={`w-5 h-5 ${plan.recommended ? 'text-[#25D366]' : 'text-slate-400'}`} />
                  </div>
                  <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-white">${plan.price}</span>
                    <span className="text-slate-500 text-sm">/month</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{plan.orders}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  <li className="flex items-start gap-2 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                    <span>
                      {plan.messages === -1 ? 'Unlimited messages/mo' : `${plan.messages.toLocaleString()} messages/mo`}
                    </span>
                  </li>
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`inline-flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl text-sm transition group ${
                    plan.recommended
                      ? 'bg-[#25D366] hover:bg-[#1db954] text-white shadow-lg shadow-green-500/20'
                      : 'bg-white/8 hover:bg-white/15 text-slate-200'
                  }`}
                >
                  Start free trial
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          Billing is handled securely by Shopify. You won&apos;t be charged until your {TRIAL_DAYS}-day trial ends.
          <br />
          Need a custom plan?{' '}
          <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">Contact us</a>
        </p>
      </section>

      <Footer />
    </div>
  )
}

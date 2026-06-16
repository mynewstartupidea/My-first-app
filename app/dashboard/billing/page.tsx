export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, Zap, Check, ArrowRight, IndianRupee, AlertCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

const PLANS = [
  {
    name: 'Starter', price: 999, paise: 99900, messages: 2000,
    features: ['2,000 messages/month', 'Abandoned cart recovery', 'COD verification', 'Order confirmation', 'Shipping updates', 'Basic analytics'],
    highlight: false, color: 'border-slate-200',
  },
  {
    name: 'Growth', price: 2499, paise: 249900, messages: 8000,
    features: ['8,000 messages/month', 'Everything in Starter', 'Campaign broadcasts', 'Post-purchase upsell', 'Win-back campaigns', 'Review requests', 'Advanced analytics', 'Priority support'],
    highlight: true, color: 'border-[#25D366]',
  },
  {
    name: 'Scale', price: 5999, paise: 599900, messages: 25000,
    features: ['25,000 messages/month', 'Everything in Growth', 'Team members (5)', 'A/B testing campaigns', 'Revenue attribution', 'Custom automations', 'API access', 'Dedicated support'],
    highlight: false, color: 'border-slate-200',
  },
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: billing } = await supabase
    .from('billing').select('*').eq('user_id', user.id).maybeSingle()

  const used      = billing?.messages_used ?? 0
  const limit     = billing?.messages_limit ?? 500
  const plan      = billing?.plan_name ?? 'trial'
  const status    = billing?.status ?? 'trialing'
  const usagePct  = Math.min(100, Math.round((used / limit) * 100))

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard size={22} className="text-slate-700" /> Billing
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your subscription and message usage</p>
      </div>

      {/* Current usage */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-slate-900 text-lg capitalize">{plan} Plan</p>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                status === 'trialing' ? 'bg-blue-50 text-blue-600' :
                'bg-red-50 text-red-600'}`}>
                {status}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              {used.toLocaleString()} / {limit.toLocaleString()} messages used this month
            </p>
          </div>
          {billing?.next_billing_date && (
            <div className="text-right">
              <p className="text-xs text-slate-400">Next billing</p>
              <p className="text-sm font-semibold text-slate-700">
                {new Date(billing.next_billing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-slate-500">Message quota</span>
          <span className="text-xs font-semibold text-slate-700">{usagePct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-[#25D366]'}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>

        {usagePct > 80 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} />
            You&apos;ve used {usagePct}% of your quota. Upgrade to avoid disruption.
          </div>
        )}
      </div>

      {/* Plans */}
      <h2 className="font-bold text-slate-800 text-base mb-4">Choose a Plan</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {PLANS.map(p => (
          <div key={p.name}
            className={`bg-white rounded-2xl border-2 shadow-sm p-5 relative ${p.highlight ? 'border-[#25D366]' : 'border-slate-200'}`}>
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
            )}
            <p className="font-bold text-slate-900 text-base">{p.name}</p>
            <div className="flex items-baseline gap-1 my-2">
              <span className="text-slate-400 text-sm">₹</span>
              <span className="text-3xl font-bold text-slate-900">{p.price.toLocaleString()}</span>
              <span className="text-slate-400 text-sm">/mo</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">{p.messages.toLocaleString()} messages/month</p>
            <ul className="space-y-2 mb-5">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check size={12} className="text-[#25D366] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/settings?tab=billing"
              className={`w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition ${
                p.highlight
                  ? 'bg-[#25D366] text-white hover:bg-[#1aad54]'
                  : plan.toLowerCase() === p.name.toLowerCase()
                    ? 'bg-slate-100 text-slate-500 cursor-default'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}>
              {plan.toLowerCase() === p.name.toLowerCase() ? 'Current Plan' : 'Upgrade'} {plan.toLowerCase() !== p.name.toLowerCase() && <ArrowRight size={13} />}
            </Link>
          </div>
        ))}
      </div>

      {/* Revenue context */}
      <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-6 text-white">
        <TrendingUp size={20} className="mb-3 opacity-80" />
        <p className="font-bold text-lg">Every message is an investment</p>
        <p className="text-green-100 text-sm mt-1 mb-4">
          Merchants on Growth plan recover an average of ₹15,000–₹50,000/month from abandoned carts alone.
          Your messages pay for themselves.
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Avg Cart Recovery', value: '₹1,240' },
            { label: 'Recovery Rate', value: '18%' },
            { label: 'ROI on messages', value: '12x' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-green-200 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BarChart2, Check, Zap, Star, Building2, ArrowUpRight } from 'lucide-react'
import { SHOPIFY_PLANS } from '@/lib/shopify-billing'
import Link from 'next/link'

const PLAN_MAP = Object.fromEntries(SHOPIFY_PLANS.map(p => [p.id, p]))

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter:    Zap,
  growth:     Star,
  scale:      Building2,
  enterprise: Building2,
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: billing } = await supabase
    .from('billing')
    .select('plan_name, status, billing_provider, messages_used, messages_limit, current_period_end, shopify_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: store } = await supabase
    .from('stores')
    .select('shopify_domain')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const used     = billing?.messages_used   ?? 0
  const limit    = billing?.messages_limit  ?? 500
  const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const planId   = billing?.plan_name ?? 'trial'
  const status   = billing?.status    ?? 'trialing'
  const provider = billing?.billing_provider ?? 'shopify'
  const isShopify = provider === 'shopify'

  const plan = PLAN_MAP[planId as keyof typeof PLAN_MAP]
  const planName = plan?.name ?? 'Trial'
  const planPrice = plan?.price ?? 0
  const PlanIcon = PLAN_ICONS[planId] ?? Zap

  const periodEnd = billing?.current_period_end
    ? new Date(billing.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const statusLabel = status === 'trialing' ? 'Trial'
    : status === 'active'    ? 'Active'
    : status === 'cancelled' ? 'Cancelled'
    : status === 'past_due'  ? 'Past Due'
    : 'Inactive'

  const statusColor = status === 'active'    ? 'bg-emerald-50 text-emerald-600'
    : status === 'trialing'  ? 'bg-blue-50 text-blue-600'
    : status === 'cancelled' ? 'bg-red-50 text-red-500'
    : 'bg-slate-100 text-slate-500'

  const changePlanHref = isShopify && store?.shopify_domain
    ? `/shopify/pricing?shop=${encodeURIComponent(store.shopify_domain)}&change=1`
    : null

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 size={22} className="text-slate-700" /> Billing & Usage
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your plan and track message usage.</p>
      </div>

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
              <PlanIcon size={18} className="text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-slate-900 text-lg">{planName}</p>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              {planPrice > 0 && (
                <p className="text-slate-500 text-sm">${planPrice}/month</p>
              )}
              {plan?.orders && (
                <p className="text-slate-400 text-xs mt-0.5">{plan.orders}</p>
              )}
              {periodEnd && (
                <p className="text-slate-400 text-xs mt-1">
                  {status === 'trialing' ? 'Trial ends' : 'Renews'}: {periodEnd}
                </p>
              )}
            </div>
          </div>

          {changePlanHref && (
            <Link
              href={changePlanHref}
              className="flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:text-[#128C7E] transition"
            >
              Change plan <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Message usage */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 text-base">Message usage</h2>
          <span className="text-sm text-slate-500">
            {used.toLocaleString()} / {limit === 999_999_999 ? 'Unlimited' : limit.toLocaleString()}
          </span>
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-slate-500">Used this month</span>
          <span className="text-xs font-semibold text-slate-700">{usagePct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-400' : usagePct >= 70 ? 'bg-yellow-400' : 'bg-[#25D366]'}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        {usagePct >= 80 && (
          <p className="text-xs text-amber-600 mt-2">
            You&apos;re approaching your message limit.{' '}
            {changePlanHref && <Link href={changePlanHref} className="underline font-medium">Upgrade your plan</Link>}
          </p>
        )}
      </div>

      {/* Plan features */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 text-base mb-4">Included in your plan</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Abandoned cart recovery',
            'COD verification',
            'Order & shipping updates',
            'Campaign broadcasts',
            'Analytics dashboard',
            ...(planId === 'scale' || planId === 'enterprise' ? ['Advanced analytics', 'Priority support'] : ['Email & chat support']),
            ...(planId === 'enterprise' ? ['Dedicated account manager', 'Custom integrations'] : []),
          ].map(feature => (
            <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
              <Check size={14} className="text-[#25D366] flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        {changePlanHref && planId !== 'enterprise' && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <Link
              href={changePlanHref}
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              Upgrade plan <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

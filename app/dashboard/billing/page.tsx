'use client'

import { useEffect, useState } from 'react'
import { BarChart2, Check, Zap, Star, Building2, Loader2, RefreshCw } from 'lucide-react'
import { SHOPIFY_PLANS } from '@/lib/shopify-billing'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const PLAN_ICONS = [Zap, Star, Building2, Building2]

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-600',
  trialing:  'bg-blue-50 text-blue-600',
  cancelled: 'bg-red-50 text-red-500',
  past_due:  'bg-amber-50 text-amber-600',
}

export default function BillingPage() {
  const [billing,   setBilling]   = useState<{ plan_name: string; status: string; messages_used: number; messages_limit: number } | null>(null)
  const [shop,      setShop]      = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error,     setError]     = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [billingRes, storeRes] = await Promise.all([
      fetch('/api/billing/status'),
      supabase.from('stores').select('shopify_domain').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])

    if (billingRes.ok) setBilling(await billingRes.json())
    if (storeRes.data?.shopify_domain) setShop(storeRes.data.shopify_domain)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function selectPlan(planId: string) {
    if (!shop) {
      setError('Connect your Shopify store first (Settings → Store) to manage billing.')
      return
    }
    setSelecting(planId)
    setError('')
    try {
      const res  = await fetch('/api/shopify/billing/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, shop }),
      })
      const data = await res.json() as { confirmationUrl?: string; error?: string }
      if (!res.ok || !data.confirmationUrl) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setSelecting(null)
        return
      }
      window.location.href = data.confirmationUrl
    } catch {
      setError('Network error. Please try again.')
      setSelecting(null)
    }
  }

  const currentPlanId = billing?.plan_name ?? 'trial'
  const used          = billing?.messages_used  ?? 0
  const limit         = billing?.messages_limit ?? 500
  const usagePct      = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const status        = billing?.status ?? 'trialing'
  const currentShopifyPlan = SHOPIFY_PLANS.find(p => p.id === currentPlanId)

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 size={22} className="text-slate-700" /> Billing & Usage
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage your plan and track message usage.</p>
        </div>
        <button onClick={load} disabled={loading} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
        </div>
      ) : (
        <>
          {/* Current plan + usage */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <p className="font-bold text-slate-900 text-lg capitalize">
                {currentShopifyPlan?.name ?? 'Trial'}
              </p>
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize', STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-500')}>
                {status === 'trialing' ? 'Trial' : status}
              </span>
              {currentShopifyPlan && (
                <span className="text-slate-400 text-sm">${currentShopifyPlan.price}/month</span>
              )}
            </div>

            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-600 font-medium">Message usage</span>
              <span className="text-slate-500">{used.toLocaleString()} / {limit >= 999_999_999 ? 'Unlimited' : limit.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', usagePct >= 90 ? 'bg-red-400' : usagePct >= 70 ? 'bg-yellow-400' : 'bg-[#25D366]')}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Resets on the 1st of each month</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Plan cards */}
          <h2 className="font-bold text-slate-900 mb-4">Choose a plan</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHOPIFY_PLANS.map((plan, i) => {
              const Icon       = PLAN_ICONS[i]
              const isCurrent  = plan.id === currentPlanId
              const isLoading  = selecting === plan.id
              const anyLoading = selecting !== null

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative bg-white rounded-2xl border p-5 flex flex-col shadow-sm',
                    isCurrent ? 'border-[#25D366] ring-1 ring-[#25D366]' : 'border-slate-100',
                    plan.recommended && !isCurrent ? 'border-[#25D366]/40' : '',
                  )}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 right-4 bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      Current
                    </div>
                  )}
                  {plan.recommended && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                      Most popular
                    </div>
                  )}

                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', plan.recommended ? 'bg-[#25D366]/10' : 'bg-slate-100')}>
                    <Icon className={cn('w-4 h-4', plan.recommended ? 'text-[#25D366]' : 'text-slate-500')} />
                  </div>
                  <p className="font-bold text-slate-900 text-base">{plan.name}</p>
                  <div className="flex items-baseline gap-0.5 mt-0.5 mb-1">
                    <span className="text-2xl font-extrabold text-slate-900">${plan.price}</span>
                    <span className="text-slate-400 text-xs">/mo</span>
                  </div>
                  <p className="text-slate-400 text-xs mb-4">{plan.orders}</p>

                  <ul className="space-y-1.5 flex-1 mb-5">
                    <li className="flex items-start gap-1.5 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                      {plan.messages === -1 ? 'Unlimited messages' : `${plan.messages.toLocaleString()} messages/mo`}
                    </li>
                    <li className="flex items-start gap-1.5 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                      WhatsApp automation
                    </li>
                    <li className="flex items-start gap-1.5 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-[#25D366] mt-0.5 flex-shrink-0" />
                      {plan.id === 'enterprise' ? 'Dedicated support' : 'Email & chat support'}
                    </li>
                  </ul>

                  <button
                    onClick={() => selectPlan(plan.id)}
                    disabled={isCurrent || anyLoading}
                    className={cn(
                      'w-full py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition',
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : plan.recommended
                          ? 'bg-[#25D366] hover:bg-[#128C7E] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800',
                      anyLoading && !isCurrent ? 'opacity-60' : '',
                    )}
                  >
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      : isCurrent ? 'Current plan' : 'Select plan'}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="mt-6 text-slate-400 text-xs text-center">
            Billing handled securely by Shopify · 7-day free trial on new plans · Cancel anytime
          </p>
        </>
      )}
    </div>
  )
}

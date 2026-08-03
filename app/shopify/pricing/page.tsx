'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MessageCircle, Check, Loader2, Star, Zap, Building2 } from 'lucide-react'
import { SHOPIFY_PLANS, TRIAL_DAYS, TRIAL_MESSAGES } from '@/lib/shopify-billing'
import Link from 'next/link'

function PricingContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const shop         = searchParams.get('shop') ?? ''
  const declined     = searchParams.get('declined') === '1'
  const isChange     = searchParams.get('change') === '1'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!shop) router.replace('/dashboard/integrations')
  }, [shop, router])

  async function handleSelect(planId: string) {
    if (!shop) return
    setLoading(planId)
    setError('')
    try {
      const res = await fetch('/api/shopify/billing/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, shop }),
      })
      const data = await res.json() as { confirmationUrl?: string; error?: string }
      if (!res.ok || !data.confirmationUrl) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(null)
        return
      }
      // Redirect merchant to Shopify's billing approval page
      window.location.href = data.confirmationUrl
    } catch {
      setError('Network error. Please try again.')
      setLoading(null)
    }
  }

  const icons = [Zap, Star, Building2, Building2]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-[#25D366]" />
          </div>
          <span className="text-white text-xl font-bold">Wapaci</span>
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          {isChange ? 'Change your plan' : 'Choose your plan'}
        </h1>
        <p className="text-green-100 text-sm sm:text-base max-w-md mx-auto">
          {isChange ? 'Switch plans anytime — changes take effect immediately.' : `${TRIAL_DAYS}-day free trial · ${TRIAL_MESSAGES} messages included · Cancel anytime`}
        </p>
        {declined && (
          <p className="mt-4 text-sm bg-white/20 text-white rounded-xl px-4 py-2 inline-block">
            Plan selection was cancelled — please pick a plan to continue.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 max-w-sm w-full bg-red-500/20 border border-red-400/40 text-white text-sm rounded-xl px-4 py-3 text-center">
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
        {SHOPIFY_PLANS.map((plan, i) => {
          const Icon      = icons[i]
          const isLoading = loading === plan.id
          const anyLoad   = loading !== null

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-6 flex flex-col shadow-xl transition-transform hover:-translate-y-1 ${
                plan.recommended ? 'ring-2 ring-[#25D366]' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                  Most popular
                </div>
              )}

              <div className="mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  plan.recommended ? 'bg-[#25D366]/10' : 'bg-slate-100'
                }`}>
                  <Icon className={`w-5 h-5 ${plan.recommended ? 'text-[#25D366]' : 'text-slate-500'}`} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">${plan.price}</span>
                  <span className="text-slate-400 text-sm mb-1">/month</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                  <span>{plan.orders}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                  <span>
                    {plan.messages === -1 ? 'Unlimited messages' : `${plan.messages.toLocaleString()} messages/mo`}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                  <span>WhatsApp automation</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                  <span>{plan.id === 'enterprise' ? 'Dedicated support' : 'Email & chat support'}</span>
                </li>
                {(plan.id === 'scale' || plan.id === 'enterprise') && (
                  <li className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                    <span>Advanced analytics</span>
                  </li>
                )}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={anyLoad}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  plan.recommended
                    ? 'bg-[#25D366] hover:bg-[#128C7E] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                } disabled:opacity-60`}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : (
                  `Start free trial`
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Enterprise / custom note */}
      <p className="mt-8 text-green-200 text-sm text-center">
        Need a custom plan?{' '}
        <a href="mailto:support@wapaci.com" className="text-white underline underline-offset-2">
          Contact us
        </a>
      </p>

      <p className="mt-4 text-green-300/70 text-xs text-center max-w-md">
        Billing is handled securely by Shopify. You won&apos;t be charged until your {TRIAL_DAYS}-day trial ends.
      </p>
    </div>
  )
}

export default function ShopifyPricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}

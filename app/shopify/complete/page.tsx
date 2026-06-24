'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function buildDestination(returnTo: string, status: string) {
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/dashboard/integrations'
  const url = new URL(safeReturnTo, window.location.origin)
  url.searchParams.set('shopify', status || 'connected')
  return `${url.pathname}${url.search}`
}

function ShopifyCompleteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState('Finishing Shopify connection...')

  useEffect(() => {
    let cancelled = false

    async function continueToApp() {
      const status = searchParams.get('shopify') ?? 'connected'
      const returnTo = searchParams.get('returnTo') ?? '/dashboard/integrations'
      const destination = buildDestination(returnTo, status)

      await supabase.auth.getSession()
      const { data } = await supabase.auth.refreshSession()
      const hasSession = !!data.session || !!(await supabase.auth.getSession()).data.session

      if (cancelled) return

      if (hasSession) {
        setMessage('Shopify connected. Opening your dashboard...')
        router.replace(destination)
      } else {
        setMessage('Shopify connected. Please sign in to continue.')
        router.replace(`/login?returnTo=${encodeURIComponent(destination)}`)
      }
    }

    const timeout = window.setTimeout(continueToApp, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [router, searchParams, supabase])

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-8 w-full max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-7 h-7 text-[#25D366]" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Shopify connected</h1>
        <p className="text-sm text-slate-500 mt-2">{message}</p>
        <Loader2 className="w-5 h-5 animate-spin text-[#25D366] mx-auto mt-5" />
      </div>
    </main>
  )
}

export default function ShopifyCompletePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </main>
    }>
      <ShopifyCompleteInner />
    </Suspense>
  )
}

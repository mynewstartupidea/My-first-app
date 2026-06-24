'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plug, CheckCircle2, MessageCircle, Zap, AlertCircle,
  Loader2, ExternalLink, RefreshCw, Unplug, Package,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { pickPreferredStore } from '@/lib/store-selection'
import type { Store } from '@/types'

const OTHER_INTEGRATIONS = [
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    desc: 'Connect your WordPress WooCommerce store to automate WhatsApp messaging.',
    logo: '🛒',
    status: 'coming_soon',
    category: 'Ecommerce',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API (Meta)',
    desc: 'Connect your own WhatsApp Business number via Meta directly.',
    logo: '💬',
    status: 'available',
    category: 'Messaging',
    href: '/dashboard/settings?tab=whatsapp',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    desc: 'Send payment links and transaction notifications via WhatsApp.',
    logo: '💳',
    status: 'coming_soon',
    category: 'Payments',
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    desc: 'Trigger WhatsApp shipping updates automatically from Shiprocket.',
    logo: '🚚',
    status: 'coming_soon',
    category: 'Logistics',
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    desc: 'Automated order tracking notifications via Delhivery.',
    logo: '📦',
    status: 'coming_soon',
    category: 'Logistics',
  },
] as const

const categories = ['All', 'Ecommerce', 'Messaging', 'Payments', 'Logistics'] as const

// ─── Main inner component ─────────────────────────────────────────────────────

function IntegrationsInner() {
  const searchParams = useSearchParams()

  const [store, setStore]               = useState<Store | null>(null)
  const [loadingStore, setLoadingStore] = useState(true)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [testing, setTesting]           = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [domain, setDomain]             = useState('')
  const [connecting, setConnecting]     = useState(false)

  const router  = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }, [])

  const loadStore = useCallback(async () => {
    setLoadingStore(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingStore(false); return }
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10)
    setStore(pickPreferredStore(data))
    setLoadingStore(false)
  }, [supabase])

  useEffect(() => { loadStore() }, [loadStore])

  useEffect(() => {
    function handleShopifyMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'SHOPIFY_CONNECTED') return
      setConnecting(false)
      showToast('Shopify store connected successfully!')
      loadStore()
      router.refresh()
    }

    window.addEventListener('message', handleShopifyMessage)
    return () => window.removeEventListener('message', handleShopifyMessage)
  }, [loadStore, router, showToast])

  useEffect(() => {
    if (!connecting) return
    const interval = window.setInterval(async () => {
      const res = await fetch('/api/shopify/test-connection')
      if (res.ok) {
        const data = await res.json().catch(() => null) as { connected?: boolean } | null
        if (data?.connected) {
          setConnecting(false)
          showToast('Shopify store connected successfully!')
          await loadStore()
          router.refresh()
        }
      }
    }, 3000)

    return () => window.clearInterval(interval)
  }, [connecting, loadStore, router, showToast])

  useEffect(() => {
    const status = searchParams.get('shopify')
    if (status === 'connected') showToast('Shopify store connected successfully!')
    const errors: Record<string, string> = {
      error: 'Could not connect to Shopify. Please try again.',
      invalid_callback: 'Shopify did not return the required OAuth details.',
      invalid_hmac: 'Shopify callback signature could not be verified.',
      invalid_state: 'Shopify security state expired. Please try connecting again.',
      token_failed: 'Shopify approved the app, but token exchange failed. Check API key and secret.',
      shop_failed: 'Shopify connected, but shop details could not be fetched. Check app scopes.',
      store_failed: 'Shopify connected, but we could not save the store. Please contact support.',
      oauth_failed: 'Shopify connected, but setup could not finish. Please try again.',
    }
    if (status && errors[status]) showToast(errors[status], false)
  }, [searchParams, showToast])

  const isShopifyConnected = !!store?.shopify_domain

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!domain.trim()) return
    setConnecting(true)
    let shop = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!shop.includes('.myshopify.com')) shop = `${shop}.myshopify.com`
    const url = `/dashboard/shopify/connect?shop=${encodeURIComponent(shop)}&returnTo=/dashboard/integrations&popup=1`
    const popup = window.open(url, 'wapaci-shopify-connect', 'width=960,height=760')
    if (!popup) window.location.href = url
  }

  async function handleTestConnection() {
    setTesting(true)
    const res = await fetch('/api/shopify/test-connection')
    const data = await res.json() as { connected: boolean; shop_name?: string; shop_domain?: string; error?: string }
    setTesting(false)
    if (data.connected) {
      showToast(`Connection OK — ${data.shop_name ?? data.shop_domain}`)
    } else {
      showToast(data.error ?? 'Connection test failed', false)
    }
  }

  async function handleSyncProducts() {
    setSyncing(true)
    const res  = await fetch('/api/shopify/sync-products', { method: 'POST' })
    const data = await res.json() as { count?: number; error?: string }
    setSyncing(false)
    if (res.ok && data.count !== undefined) {
      showToast(`Synced! Found ${data.count} product${data.count !== 1 ? 's' : ''} in your store.`)
      setStore(prev => prev ? { ...prev, product_count: data.count! } : prev)
    } else {
      showToast(data.error ?? 'Sync failed', false)
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${store?.shopify_domain}?\n\nAutomations will stop. Your WhatsApp settings, conversations, and analytics are kept.`)) return
    setDisconnecting(true)
    const res = await fetch('/api/shopify/disconnect', { method: 'POST' })
    setDisconnecting(false)
    if (res.ok) {
      await loadStore()
      router.refresh()  // re-renders server components so sidebar updates immediately
      showToast('Shopify disconnected. You can reconnect anytime.')
    } else {
      showToast('Failed to disconnect. Please try again.', false)
    }
  }

  const filtered = OTHER_INTEGRATIONS.filter(i =>
    activeCategory === 'All' || i.category === activeCategory
  )

  return (
    <div className="p-6 lg:p-8">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium max-w-sm',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">Connect Wapaci with your ecommerce stack</p>
        </div>
      </div>

      {/* ── Shopify status banner ───────────────────────────────────────────── */}
      {loadingStore ? (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />
          <p className="text-slate-500 text-sm">Checking store connection…</p>
        </div>

      ) : isShopifyConnected ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800">
                {store.shop_name ?? store.shopify_domain} — Shopify connected
              </p>
              <p className="text-green-700 text-sm mt-0.5 truncate">{store.shopify_domain}</p>
              {store.connected_at && (
                <p className="text-green-600 text-xs mt-0.5">
                  Connected {new Date(store.connected_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
              {(store.product_count ?? 0) > 0 && (
                <p className="text-green-600 text-xs mt-0.5">
                  {store.product_count} product{store.product_count !== 1 ? 's' : ''} synced
                </p>
              )}
            </div>
            <a
              href={`https://${store.shopify_domain}/admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-100 transition flex-shrink-0"
              title="Open Shopify Admin"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-4 ml-9 flex-wrap">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 text-sm font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 px-3 py-2 rounded-xl transition"
            >
              {testing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Test Connection
            </button>
            <button
              onClick={handleSyncProducts}
              disabled={syncing}
              className="flex items-center gap-2 text-sm font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 px-3 py-2 rounded-xl transition"
            >
              {syncing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Package className="w-3.5 h-3.5" />}
              Sync Products
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 px-3 py-2 rounded-xl transition"
            >
              {disconnecting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Unplug className="w-3.5 h-3.5" />}
              Disconnect
            </button>
          </div>
        </div>

      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Connect your Shopify store to get started</p>
              <p className="text-amber-700 text-sm mt-0.5">
                Enter your Shopify store URL — takes under 2 minutes.
              </p>
              <form onSubmit={handleConnect} className="mt-4 flex gap-2">
                <input
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="flex-1 px-3 py-2 border border-amber-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={connecting || !domain.trim()}
                  className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap"
                >
                  {connecting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Plug className="w-3.5 h-3.5" />}
                  {connecting ? 'Connecting…' : 'Connect'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Shopify card + other integrations ─────────────────────────────── */}

      {/* Category filter (other integrations) */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
              activeCategory === cat
                ? 'bg-[#25D366] text-white'
                : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Shopify card — always shown when in Ecommerce or All */}
        {(activeCategory === 'All' || activeCategory === 'Ecommerce') && (
          <div className={cn(
            'bg-white rounded-2xl border shadow-sm p-5 flex flex-col',
            isShopifyConnected ? 'border-[#25D366]/40' : 'border-slate-100'
          )}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-2xl border border-slate-100">
                  🛍️
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Shopify</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Ecommerce</span>
                </div>
              </div>
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                isShopifyConnected
                  ? 'bg-[#25D366]/10 text-[#25D366]'
                  : 'bg-green-100 text-green-700'
              )}>
                {isShopifyConnected ? 'Connected' : 'Available'}
              </span>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed flex-1">
              Sync orders, customers, and abandoned carts from your Shopify store.
            </p>

            {isShopifyConnected && store && (
              <p className="text-xs text-[#25D366] mt-2 truncate">{store.shopify_domain}</p>
            )}

            <div className="mt-4">
              {isShopifyConnected && store ? (
                <div className="flex gap-2">
                  <a
                    href={`https://${store.shopify_domain}/admin`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-2.5 rounded-xl transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Manage
                  </a>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center justify-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium px-3 py-2.5 rounded-xl transition"
                  >
                    {disconnecting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Unplug className="w-3.5 h-3.5" />}
                    Disconnect
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConnect} className="flex gap-2">
                  <input
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="yourstore.myshopify.com"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={connecting || !domain.trim()}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-xl transition whitespace-nowrap"
                  >
                    {connecting
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Plug className="w-3 h-3" />}
                    {connecting ? '…' : 'Connect'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Other integrations */}
        {filtered.map(intg => (
          <div key={intg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-2xl border border-slate-100">
                  {intg.logo}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{intg.name}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{intg.category}</span>
                </div>
              </div>
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                intg.status === 'coming_soon' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'
              )}>
                {intg.status === 'coming_soon' ? 'Coming Soon' : 'Available'}
              </span>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed flex-1">{intg.desc}</p>

            <div className="mt-4">
              {intg.status === 'coming_soon' ? (
                <button disabled className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-medium px-4 py-2.5 rounded-xl cursor-not-allowed">
                  Coming Soon
                </button>
              ) : 'href' in intg ? (
                <Link
                  href={intg.href}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                >
                  <Plug className="w-4 h-4" /> Connect
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Request integration */}
      <div className="mt-8 bg-white/50 border border-slate-200 rounded-2xl p-6 text-center">
        <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-700">Don&apos;t see your platform?</p>
        <p className="text-slate-500 text-sm mt-1">
          Let us know what you need. We&apos;re adding new integrations based on customer requests.
        </p>
        <a
          href="mailto:support@wapaci.com?subject=Integration Request"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline"
        >
          <MessageCircle className="w-4 h-4" /> Request an integration
        </a>
      </div>
    </div>
  )
}

// ─── Page with Suspense (required for useSearchParams) ────────────────────────

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    }>
      <IntegrationsInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Store, MessageCircle, Loader2, Save, CheckCircle2,
  AlertCircle, ExternalLink, Trash2, Info, ChevronDown, ChevronUp,
  CreditCard, Users, Shield, Crown, Zap, TrendingUp,
  UserPlus, Trash, Mail, ChevronRight, Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store as StoreType } from '@/types'

const BSP_OPTIONS = [
  { value: 'mock',     label: 'Mock (Testing)',  desc: 'Messages logged only — no real sends' },
  { value: 'interakt', label: 'Interakt',         desc: 'Recommended for India' },
  { value: 'gupshup',  label: 'Gupshup',          desc: 'Largest BSP in India' },
]

const SHOPIFY_ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: 'OAuth callback was invalid. Please try connecting again.',
  invalid_state:    'Security state mismatch. Please try connecting again.',
  oauth_failed:     'Could not connect to Shopify. Check your app credentials in Vercel.',
  not_configured:   'Shopify app credentials are not configured yet. Follow the setup guide below.',
}

export default function SettingsPage() {
  const searchParams = useSearchParams()

  const [store, setStore]             = useState<StoreType | null>(null)
  const [loading, setLoading]         = useState(true)
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [connecting, setConnecting]   = useState(false)
  const [savingWA, setSavingWA]       = useState(false)
  const [waNumber, setWaNumber]       = useState('')
  const [waBsp, setWaBsp]             = useState('mock')
  const [waApiKey, setWaApiKey]       = useState('')
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [userEmail, setUserEmail]     = useState('')
  const [showGuide, setShowGuide]     = useState(false)
  const [activeTab, setActiveTab]     = useState<'account' | 'store' | 'whatsapp' | 'billing' | 'team' | 'security'>('account')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'admin' | 'manager' | 'support'>('support')
  const [pendingInvites, setPendingInvites] = useState<{ email: string; role: string }[]>([])
  const [teamMembers] = useState([
    { id: '1', name: 'You (Owner)', email: userEmail || 'you@yourstore.com', role: 'owner', initials: 'YO' },
  ])

  const supabase = useMemo(() => createClient(), [])

  const urlError   = searchParams.get('error')
  const urlSuccess = searchParams.get('connected')

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserEmail(user.email ?? '')
    const { data: s } = await supabase
      .from('stores').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (s) {
      setStore(s)
      setWaNumber(s.whatsapp_number ?? '')
      setWaBsp(s.whatsapp_bsp ?? 'mock')
      setWaApiKey(s.whatsapp_api_key ?? '')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (urlSuccess) showToast('Shopify store connected successfully!')
    if (urlError)   showToast(SHOPIFY_ERROR_MESSAGES[urlError] ?? 'Something went wrong. Please try again.', false)
  }, [urlError, urlSuccess, showToast])

  async function handleConnectShopify() {
    if (!shopifyDomain.trim()) return
    let domain = shopifyDomain.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`
    setConnecting(true)
    try {
      const res = await fetch(`/api/shopify/install?shop=${domain}`, { redirect: 'manual' })
      // A 0 or 3xx means the API redirected us to Shopify OAuth — follow it
      if (res.type === 'opaqueredirect' || res.status === 0 || (res.status >= 300 && res.status < 400)) {
        window.location.href = `/api/shopify/install?shop=${domain}`
        return
      }
      // A real error response
      const data = await res.json().catch(() => ({}))
      const msg = data.error ?? 'Failed to initiate Shopify connection'
      setConnecting(false)
      showToast(msg, false)
      if (msg.toLowerCase().includes('not configured')) setShowGuide(true)
    } catch {
      window.location.href = `/api/shopify/install?shop=${domain}`
    }
  }

  async function saveWhatsApp() {
    if (!store) return
    setSavingWA(true)
    const { error } = await supabase
      .from('stores')
      .update({
        whatsapp_number:  waNumber || null,
        whatsapp_bsp:     waBsp,
        whatsapp_api_key: waApiKey || null,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', store.id)
    setSavingWA(false)
    if (error) { showToast('Failed to save settings', false); return }
    setStore(prev => prev ? { ...prev, whatsapp_number: waNumber, whatsapp_bsp: waBsp } : prev)
    showToast('WhatsApp settings saved!')
  }

  async function disconnectStore() {
    if (!store) return
    if (!confirm(`Disconnect ${store.shop_name ?? store.shopify_domain}? All automations will stop.`)) return
    await supabase.from('stores').update({ is_active: false }).eq('id', store.id)
    setStore(null)
    showToast('Store disconnected')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  const TABS = [
    { id: 'account',  label: 'Account',   icon: Store      },
    { id: 'store',    label: 'Store',      icon: Store      },
    { id: 'whatsapp', label: 'WhatsApp',   icon: MessageCircle },
    { id: 'billing',  label: 'Billing',    icon: CreditCard },
    { id: 'team',     label: 'Team',       icon: Users      },
    { id: 'security', label: 'Security',   icon: Shield     },
  ] as const

  const PLAN_META = {
    starter: { label: 'Starter', price: 'Free',         msgs: '500 messages/mo',    color: 'text-slate-600',   bg: 'bg-slate-100'   },
    growth:  { label: 'Growth',  price: '₹1,999/mo',    msgs: '5,000 messages/mo',  color: 'text-blue-600',    bg: 'bg-blue-100'    },
    scale:   { label: 'Scale',   price: '₹4,999/mo',    msgs: 'Unlimited messages', color: 'text-purple-600',  bg: 'bg-purple-100'  },
  }

  const currentPlan = (store?.plan ?? 'starter') as keyof typeof PLAN_META

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-3xl">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium max-w-sm',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account, store, billing, and team</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-7 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Account ─────────────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5', activeTab !== 'account' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-slate-500" />
          </div>
          Account
        </h2>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold text-sm">
            {userEmail[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-medium text-slate-800">{userEmail}</p>
            <p className="text-slate-400 text-xs">Account email</p>
          </div>
        </div>
      </section>

      {/* ── Ecommerce Store ─────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5', activeTab !== 'store' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-green-600" />
          </div>
          Ecommerce Store
        </h2>

        {store ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">{store.shop_name ?? store.shopify_domain}</p>
                  <p className="text-green-600 text-sm">{store.shopify_domain}</p>
                </div>
              </div>
              <a
                href={`https://${store.shopify_domain}/admin`}
                target="_blank" rel="noopener noreferrer"
                className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-100 transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <button
              onClick={disconnectStore}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect store
            </button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Connect form */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your store domain</label>
              <div className="flex gap-2">
                <input
                  value={shopifyDomain}
                  onChange={e => setShopifyDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectShopify()}
                  placeholder="yourstore.myshopify.com"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <button
                  onClick={handleConnectShopify}
                  disabled={connecting || !shopifyDomain.trim()}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>

            {/* Setup guide toggle */}
            <button
              onClick={() => setShowGuide(v => !v)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Info className="w-3.5 h-3.5" />
              {showGuide ? 'Hide' : 'Show'} setup guide
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showGuide && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <p className="font-semibold text-slate-800 text-sm">
                  How to connect your Shopify store to Wapaci (one-time setup, ~10 minutes)
                </p>

                <div className="space-y-3">
                  {[
                    {
                      step: '1',
                      title: 'Create a Shopify Partner account',
                      desc: 'Go to partners.shopify.com and sign up for free.',
                      href: 'https://partners.shopify.com',
                      cta: 'Open Shopify Partners →',
                    },
                    {
                      step: '2',
                      title: 'Create a new app',
                      desc: 'In Partners dashboard → Apps → Create app → Custom app. Set App URL and Allowed redirect URL to:',
                      code: 'https://my-first-app-three-puce.vercel.app/api/shopify/callback',
                    },
                    {
                      step: '3',
                      title: 'Copy your API credentials',
                      desc: 'From your app\'s API credentials tab, copy the Client ID and Client Secret.',
                    },
                    {
                      step: '4',
                      title: 'Add credentials to Vercel',
                      desc: 'Go to your Vercel project → Settings → Environment Variables and add:',
                      envVars: [
                        'SHOPIFY_API_KEY  →  (your Client ID)',
                        'SHOPIFY_API_SECRET  →  (your Client Secret)',
                      ],
                      href: 'https://vercel.com/dashboard',
                      cta: 'Open Vercel Dashboard →',
                    },
                    {
                      step: '5',
                      title: 'Redeploy & connect',
                      desc: 'After adding env vars, trigger a redeploy in Vercel, then come back and click Connect.',
                    },
                  ].map(({ step, title, desc, code, envVars, href, cta }) => (
                    <div key={step} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#25D366] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                        {code && (
                          <code className="block mt-1.5 text-[11px] bg-slate-200 text-slate-700 px-2 py-1.5 rounded-lg break-all font-mono">
                            {code}
                          </code>
                        )}
                        {envVars && envVars.map(v => (
                          <code key={v} className="block mt-1 text-[11px] bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono">
                            {v}
                          </code>
                        ))}
                        {href && cta && (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            className="inline-block mt-1.5 text-xs text-[#25D366] font-medium hover:underline">
                            {cta}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── WhatsApp Configuration ──────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5', activeTab !== 'whatsapp' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
          </div>
          WhatsApp Configuration
        </h2>
        <p className="text-slate-400 text-xs mb-4 ml-9">Connect your BSP account to start sending real messages</p>

        <div className="space-y-4">
          {/* BSP selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Message Provider (BSP)</label>
            <div className="grid grid-cols-3 gap-2">
              {BSP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWaBsp(opt.value)}
                  className={cn(
                    'text-left p-3 rounded-xl border-2 transition',
                    waBsp === opt.value ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <p className={cn('text-sm font-medium', waBsp === opt.value ? 'text-[#25D366]' : 'text-slate-700')}>
                    {opt.label}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Phone number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Phone Number</label>
            <input
              value={waNumber}
              onChange={e => setWaNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
            <p className="text-slate-400 text-xs mt-1">The WhatsApp number registered with your BSP</p>
          </div>

          {/* API Key (only for real BSPs) */}
          {waBsp !== 'mock' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {waBsp === 'interakt' ? 'Interakt API Key' : 'Gupshup API Key'}
              </label>
              <input
                type="password"
                value={waApiKey}
                onChange={e => setWaApiKey(e.target.value)}
                placeholder={waBsp === 'interakt' ? 'From Interakt → Settings → Developer' : 'From Gupshup → Partner Portal'}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
          )}

          {waBsp === 'mock' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 text-xs">
                Mock mode — messages are logged in your console/Vercel logs but not sent to real phones.
                Switch to Interakt or Gupshup when you're ready to go live.
              </p>
            </div>
          )}

          <button
            onClick={saveWhatsApp}
            disabled={savingWA || !store}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            {savingWA
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save WhatsApp Settings</>
            }
          </button>
          {!store && (
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <Info className="w-3 h-3" /> Connect your ecommerce store first to save WhatsApp settings.
            </p>
          )}
        </div>
      </section>

      {/* ── Billing ─────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-5">
          {/* Current plan banner */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
              </div>
              Current Plan
            </h2>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-slate-900 text-lg capitalize">{PLAN_META[currentPlan].label}</p>
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', PLAN_META[currentPlan].bg, PLAN_META[currentPlan].color)}>
                    Active
                  </span>
                </div>
                <p className="text-slate-500 text-sm">{PLAN_META[currentPlan].msgs} · {PLAN_META[currentPlan].price}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{PLAN_META[currentPlan].price}</p>
                {currentPlan !== 'starter' && <p className="text-xs text-slate-400">billed monthly</p>}
              </div>
            </div>

            {/* Usage bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-600 font-medium">Messages used this month</span>
                <span className="text-slate-500">0 / {currentPlan === 'starter' ? '500' : currentPlan === 'growth' ? '5,000' : '∞'}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-[#25D366] h-2 rounded-full" style={{ width: '0%' }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Resets on the 1st of each month</p>
            </div>

            {/* Plan actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {currentPlan !== 'scale' && (
                <button
                  onClick={() => showToast('Billing portal coming soon — contact support@wapaci.com to upgrade')}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                >
                  <TrendingUp className="w-4 h-4" /> Upgrade Plan
                </button>
              )}
              {currentPlan !== 'starter' && (
                <button
                  onClick={() => showToast('Contact billing@wapaci.com to downgrade your plan', true)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 border border-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl transition hover:bg-slate-50"
                >
                  Downgrade
                </button>
              )}
              {currentPlan !== 'starter' && (
                <button
                  onClick={() => showToast('Contact billing@wapaci.com to cancel your subscription', true)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl transition hover:bg-red-50"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          </section>

          {/* Plan comparison */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">All Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.entries(PLAN_META) as [string, typeof PLAN_META[keyof typeof PLAN_META]][]).map(([key, plan]) => (
                <div key={key} className={cn(
                  'rounded-2xl border-2 p-5 transition',
                  key === currentPlan ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-slate-900">{plan.label}</p>
                    {key === currentPlan && <span className="text-[10px] bg-[#25D366] text-white px-2 py-0.5 rounded-full font-semibold">Current</span>}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mb-1">{plan.price}</p>
                  <p className="text-slate-500 text-sm mb-4">{plan.msgs}</p>
                  {[
                    key === 'starter' ? '500 messages/mo' : key === 'growth' ? '5,000 messages/mo' : 'Unlimited messages',
                    'Abandoned cart recovery',
                    'COD verification',
                    key !== 'starter' ? 'Campaign broadcasts' : null,
                    key === 'scale' ? 'Priority support' : null,
                  ].filter(Boolean).map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-600 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" /> {f}
                    </div>
                  ))}
                  {key !== currentPlan && (
                    <button
                      onClick={() => showToast('Contact support@wapaci.com to switch plans')}
                      className={cn(
                        'w-full mt-4 text-sm font-medium py-2 rounded-xl transition',
                        key === 'scale' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                      )}
                    >
                      {key === 'starter' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Billing history */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" /> Billing History
            </h3>
            <div className="text-center py-8 text-slate-400">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No invoices yet</p>
              <p className="text-xs mt-1">Invoices will appear here once you upgrade to a paid plan</p>
            </div>
          </section>

          {/* Payment method */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" /> Payment Method
            </h3>
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No payment method on file</p>
              <p className="text-xs mt-1">Add a card when upgrading to a paid plan</p>
            </div>
          </section>
        </div>
      )}

      {/* ── Team Members ─────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          {/* Invite form */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Invite Team Member
            </h2>
            <p className="text-slate-400 text-xs mb-4 ml-9">Invite colleagues to help manage your Wapaci account</p>
            <div className="flex gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@yourstore.com"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div className="w-40 flex-shrink-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'manager' | 'support')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    if (!inviteEmail.trim()) return
                    setPendingInvites(p => [...p, { email: inviteEmail.trim(), role: inviteRole }])
                    setInviteEmail('')
                    showToast(`Invite sent to ${inviteEmail.trim()}`)
                  }}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" /> Send invite
                </button>
              </div>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              <strong>Role permissions:</strong> Admin (full access) · Manager (automations, campaigns, customers) · Support (conversations only)
            </div>
          </section>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Pending Invites</h3>
              <div className="space-y-2">
                {pendingInvites.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">
                        {inv.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{inv.email}</p>
                        <p className="text-xs text-slate-400 capitalize">{inv.role} · Invite pending</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPendingInvites(p => p.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-500 transition p-1"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Current members */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Team Members</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {userEmail[0]?.toUpperCase() ?? 'Y'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{userEmail}</p>
                    <p className="text-xs text-slate-400">Owner · Full access</p>
                  </div>
                </div>
                <span className="text-xs bg-[#25D366]/10 text-[#25D366] font-semibold px-2.5 py-1 rounded-full">Owner</span>
              </div>
              {pendingInvites.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">No other team members yet. Invite someone above.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Security ─────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              Change Password
            </h2>
            <p className="text-slate-500 text-sm mb-4">Send a password reset link to your email address.</p>
            <button
              onClick={async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
                  redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/dashboard/settings`,
                })
                if (error) showToast(error.message, false)
                else showToast('Password reset link sent! Check your inbox.')
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
            >
              <Lock className="w-4 h-4" /> Send reset link
            </button>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Two-Factor Authentication
            </h2>
            <p className="text-slate-400 text-xs mb-4 ml-9">Add an extra layer of security to your account</p>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-800 text-sm">Authenticator App</p>
                <p className="text-slate-400 text-xs mt-0.5">Use Google Authenticator or similar</p>
              </div>
              <span className="text-xs bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full font-medium">Coming soon</span>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
            <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </div>
              Danger Zone
            </h2>
            <p className="text-slate-400 text-xs mb-4 ml-9">These actions are permanent and cannot be undone.</p>
            <button
              onClick={() => showToast('To delete your account, email support@wapaci.com', true)}
              className="text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-xl transition"
            >
              Request account deletion
            </button>
          </section>
        </div>
      )}

    </div>
  )
}

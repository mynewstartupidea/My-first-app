'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, ArrowRight, Loader2, AlertCircle,
  Store, MessageCircle, Zap, ShoppingCart, Package,
  Sparkles, SkipForward, ChevronRight, ShoppingBag, UserPlus,
  Facebook, Globe, Users, Phone, Copy, Check, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasShopifyConnection } from '@/lib/store-selection'
import Link from 'next/link'

type BusinessType = 'ecommerce' | 'lead_gen'
type Step = 'welcome' | 'business_type' | 'connect' | 'whatsapp' | 'automations' | 'done'

const STEPS: Step[] = ['welcome', 'business_type', 'connect', 'whatsapp', 'automations', 'done']

const STEP_META: Record<Step, { title: string; sub: string }> = {
  welcome:       { title: 'Welcome',        sub: 'Get started'       },
  business_type: { title: 'Your Business',  sub: 'Tell us about you' },
  connect:       { title: 'Connect',        sub: 'Link your source'  },
  whatsapp:      { title: 'WhatsApp',       sub: 'Set up messaging'  },
  automations:   { title: 'Automations',    sub: 'Enable flows'      },
  done:          { title: 'All Set!',       sub: 'You\'re ready'     },
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  const visible = STEPS.slice(0, -1) // exclude 'done' from dots

  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-10">
      {visible.map((s, i) => (
        <div key={s} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className={cn(
            'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all flex-shrink-0',
            idx > i  ? 'bg-[#25D366] text-white'
            : idx === i ? 'bg-[#25D366] text-white ring-4 ring-[#25D366]/20'
            : 'bg-slate-100 text-slate-400'
          )}>
            {idx > i ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs font-medium hidden md:block whitespace-nowrap',
            idx >= i ? 'text-slate-700' : 'text-slate-400'
          )}>
            {STEP_META[s].title}
          </span>
          {i < visible.length - 1 && (
            <div className={cn('w-4 sm:w-8 h-0.5 rounded-full flex-shrink-0', idx > i ? 'bg-[#25D366]' : 'bg-slate-200')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Business type step ───────────────────────────────────────────────────────

const BUSINESS_TYPE_OPTIONS: Array<{
  key: BusinessType; icon: typeof ShoppingBag; label: string; desc: string; bullets: string[]
}> = [
  {
    key: 'ecommerce', icon: ShoppingBag, label: 'Ecommerce Store',
    desc: 'I sell products online (Shopify, etc.)',
    bullets: ['Connect your Shopify store', 'Recover abandoned carts', 'Verify COD orders over WhatsApp'],
  },
  {
    key: 'lead_gen', icon: UserPlus, label: 'Lead Generation',
    desc: 'I capture and follow up with leads',
    bullets: ['Connect Facebook Lead Ads or your website', 'Instantly message new leads', 'Follow up on missed calls'],
  },
]

function BusinessTypeStep({
  initialValue, onSelect
}: {
  initialValue: BusinessType | null
  onSelect: (type: BusinessType) => Promise<void>
}) {
  const [selected, setSelected] = useState<BusinessType | null>(initialValue)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleContinue() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      await onSelect(selected)
    } catch {
      setError('Could not save — please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">What&apos;s your business?</h2>
        <p className="text-slate-500 text-sm">This tailors your dashboard and setup — you can change it later in Settings.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {BUSINESS_TYPE_OPTIONS.map(({ key, icon: Icon, label, desc, bullets }) => {
          const on = selected === key
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={cn(
                'text-left rounded-2xl border-2 p-5 sm:p-6 transition-all',
                on ? 'border-[#25D366] bg-[#25D366]/5 shadow-md shadow-green-500/10' : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', on ? 'bg-[#25D366] text-white' : 'bg-slate-100 text-slate-500')}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition',
                  on ? 'border-[#25D366] bg-[#25D366]' : 'border-slate-300'
                )}>
                  {on && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
              <p className="font-bold text-slate-900 text-lg mb-1">{label}</p>
              <p className="text-slate-500 text-sm mb-4">{desc}</p>
              <div className="space-y-1.5">
                {bullets.map(b => (
                  <div key={b} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', on ? 'text-[#25D366]' : 'text-slate-300')} />
                    {b}
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition text-base shadow-lg shadow-green-500/20"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
      </button>
    </div>
  )
}

// ─── Welcome step ─────────────────────────────────────────────────────────────

function WelcomeStep({ email, onNext }: { email: string; onNext: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-20 h-20 bg-[#25D366]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-9 h-9 text-[#25D366]" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome to Wapaci! 👋</h1>
      <p className="text-slate-500 mb-2">You&apos;re signed in as <span className="font-semibold text-slate-700">{email}</span></p>
      <p className="text-slate-400 text-sm mb-8">
        Let&apos;s get you set up in 3 quick steps. You&apos;ll be recovering revenue with WhatsApp automations in under 10 minutes.
      </p>

      <div className="grid grid-cols-1 gap-3 mb-8 text-left">
        {[
          { icon: Store,         text: 'Connect your Shopify store'              },
          { icon: MessageCircle, text: 'Link your WhatsApp Business account'     },
          { icon: Zap,           text: 'Enable abandoned cart & COD automations' },
        ].map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-[#25D366]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-[#25D366]" />
            </div>
            <span className="text-sm text-slate-700">{text}</span>
            <CheckCircle2 className="w-4 h-4 text-[#25D366] ml-auto flex-shrink-0" />
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-3.5 rounded-2xl transition text-base shadow-lg shadow-green-500/20"
      >
        Get started <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

// ─── Connect Store step ───────────────────────────────────────────────────────

function ConnectStoreStep({
  storeConnected, onNext, onSkip
}: {
  storeConnected: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const [domain, setDomain]     = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError]       = useState('')

  function handleConnect() {
    if (!domain.trim()) return
    let d = domain.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (!d.includes('.')) d = `${d}.myshopify.com`
    if (!d.includes('.myshopify.com')) d = `${d}.myshopify.com`
    setConnecting(true)
    localStorage.setItem('wapaci_onboarding_return', 'whatsapp')
    window.location.href = `/api/shopify/install?shop=${d}&returnTo=/onboarding`
  }

  if (storeConnected) {
    return (
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Store connected!</h2>
        <p className="text-slate-500 mb-8">Your ecommerce store is linked and ready. Customers and orders will sync automatically.</p>
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-3.5 rounded-2xl transition"
        >
          Continue <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Store className="w-8 h-8 text-orange-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Connect your store</h2>
      <p className="text-slate-500 text-center mb-8">We&apos;ll sync your customers, orders, and abandoned carts automatically.</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Shopify */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-[#95BF47]/10 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5 text-[#95BF47]" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Shopify</p>
            <p className="text-xs text-slate-400">One-click OAuth connection</p>
          </div>
          <span className="ml-auto text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Available</span>
        </div>
        <div className="flex gap-2">
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="yourstore.myshopify.com"
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !domain.trim()}
            className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </button>
        </div>
      </div>

      {/* WooCommerce - coming soon */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 opacity-50 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">WooCommerce</p>
            <p className="text-xs text-slate-400">WordPress plugin coming soon</p>
          </div>
          <span className="ml-auto text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">Coming soon</span>
        </div>
      </div>

      <button
        onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition"
      >
        <SkipForward className="w-4 h-4" /> I&apos;ll connect later
      </button>
    </div>
  )
}

// ─── Connect lead source step ─────────────────────────────────────────────────

function ConnectLeadSourceStep({ onNext }: { onNext: () => void }) {
  const [apiKey, setApiKey]       = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(false)
  const [showSnippet, setShowSnippet] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [keyError, setKeyError]   = useState('')

  async function revealSnippet() {
    if (apiKey) { setShowSnippet(true); return }
    setLoadingKey(true)
    setKeyError('')
    try {
      const res  = await fetch('/api/developer/key')
      const data = await res.json() as { api_key?: string; error?: string }
      if (!res.ok || !data.api_key) { setKeyError(data.error ?? 'Could not generate your API key.'); return }
      setApiKey(data.api_key)
      setShowSnippet(true)
    } catch {
      setKeyError('Network error. Please try again.')
    } finally {
      setLoadingKey(false)
    }
  }

  function copySnippet() {
    if (!apiKey) return
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.wapaci.com'
    const snippet = `fetch('${origin}/api/leads/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKey}',
  },
  body: JSON.stringify({ name, email, phone, source: 'Website' }),
})`
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Users className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Connect a lead source</h2>
      <p className="text-slate-500 text-center mb-8">Pick how leads reach you — you can set up more than one, anytime.</p>

      {/* Facebook Lead Ads */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Facebook className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">Facebook Lead Ads</p>
            <p className="text-xs text-slate-400">Sync leads from your ad forms automatically</p>
          </div>
        </div>
        <Link
          href="/dashboard/leads"
          className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition"
        >
          Connect in Leads <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Website / landing page form */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">Website or landing page form</p>
            <p className="text-xs text-slate-400">Send form submissions straight to Wapaci</p>
          </div>
        </div>

        {keyError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {keyError}
          </div>
        )}

        {!showSnippet ? (
          <button
            onClick={revealSnippet}
            disabled={loadingKey}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            {loadingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get my API snippet'}
          </button>
        ) : (
          <div>
            <pre className="bg-slate-900 text-slate-100 text-[10px] sm:text-[11px] rounded-xl p-3 overflow-x-auto mb-2 leading-relaxed">
{`fetch('.../api/leads/ingest', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ${apiKey?.slice(0, 12)}…' },
  body: JSON.stringify({ name, email, phone }),
})`}
            </pre>
            <button
              onClick={copySnippet}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl transition"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied full snippet</> : <><Copy className="w-3.5 h-3.5" /> Copy full snippet</>}
            </button>
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Prefer to add leads yourself?</p>
            <p className="text-xs text-slate-400">The Leads page always lets you add one manually — no setup needed.</p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-3.5 rounded-2xl transition"
      >
        Continue <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

// ─── WhatsApp step ────────────────────────────────────────────────────────────

declare global {
  interface Window {
    FB?: {
      init: (o: object) => void
      login: (cb: (r: { authResponse?: { code?: string } | null; status?: string }) => void, opts: object) => void
    }
    fbAsyncInit?: () => void
  }
}

function WhatsAppStep({
  storeId, onNext, onSkip
}: {
  storeId: string | null
  onNext: () => void
  onSkip: () => void
}) {
  const [fbReady,    setFbReady]    = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [phone,      setPhone]      = useState('')
  const [error,      setError]      = useState('')
  const supabase = useMemo(() => createClient(), [])

  // Load FB SDK
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    if (!appId) return
    if (window.FB) { setFbReady(true); return }
    window.fbAsyncInit = function () {
      window.FB!.init({ appId, version: 'v22.0', xfbml: false, status: false })
      setFbReady(true)
    }
    if (!document.getElementById('fb-jssdk')) {
      const s = document.createElement('script')
      s.id  = 'fb-jssdk'
      s.src = 'https://connect.facebook.net/en_US/sdk.js'
      s.async = true; s.defer = true
      document.head.appendChild(s)
    }
  }, [])

  async function launchSignup() {
    if (!window.FB) { setError('Facebook SDK not ready — refresh and try again.'); return }
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID
    if (!configId) { setError('WhatsApp signup not configured. Please contact support.'); return }
    setConnecting(true)
    setError('')

    const fbLoginOpts = {
      config_id:                      configId,
      response_type:                  'code',
      override_default_response_type: true,
      extras:                         { sessionInfoVersion: 2 },
    }

    // Safety timeout — reset if FB never fires the callback
    const timeoutId = setTimeout(() => {
      setConnecting(false)
      setError('Connection timed out. Please try again.')
    }, 5 * 60 * 1000)

    window.FB.login(async (response) => {
      clearTimeout(timeoutId)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any
      const code = raw?.authResponse?.code as string | undefined

      // Extract sessionInfo — Meta places it in different locations across SDK versions
      const candidateInfo =
        raw?.authResponse?.sessionInfo ??
        raw?.authResponse?.session_info ??
        raw?.sessionInfo ??
        raw?.session_info ??
        null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function hasWabaFields(x: any) { return !!(x?.wabaID || x?.waba_id || x?.phoneNumberID || x?.phone_number_id) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function normalise(x: any) {
        if (!x) return null
        return {
          businessID:         x.businessID         ?? x.business_id         ?? undefined,
          wabaID:             x.wabaID              ?? x.waba_id             ?? undefined,
          phoneNumberID:      x.phoneNumberID       ?? x.phone_number_id     ?? undefined,
          displayPhoneNumber: x.displayPhoneNumber  ?? x.display_phone_number ?? undefined,
        }
      }
      const sessionInfo = hasWabaFields(candidateInfo) ? normalise(candidateInfo) : null

      if (!code) {
        setConnecting(false)
        const status = response?.status ?? ''
        if (status !== 'unknown' && status !== '') setError('WhatsApp connection cancelled.')
        return
      }

      try {
        const res  = await fetch('/api/meta/callback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code, sessionInfo }),
        })
        const data = await res.json() as { ok: boolean; phone?: string; error?: string }
        if (!data.ok) { setError(data.error ?? 'Connection failed. Try again.'); setConnecting(false); return }

        if (storeId) {
          await supabase.from('stores').update({ whatsapp_bsp: 'meta', updated_at: new Date().toISOString() }).eq('id', storeId)
        }
        setPhone(data.phone ?? '')
        setConnected(true)
        setConnecting(false)
        setTimeout(onNext, 1500)
      } catch {
        setError('Network error. Please try again.')
        setConnecting(false)
      }
    }, fbLoginOpts)
  }

  if (connected) {
    return (
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">WhatsApp connected!</h2>
        <p className="text-slate-500 mb-2">{phone && <span className="font-semibold text-slate-700">{phone}</span>}</p>
        <p className="text-slate-400 text-sm">Your WhatsApp Business number is ready. Moving to the next step…</p>
        <Loader2 className="w-5 h-5 animate-spin text-[#25D366] mx-auto mt-6" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <MessageCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Connect WhatsApp</h2>
      <p className="text-slate-500 text-center mb-8 text-sm">
        Link your WhatsApp Business number via Meta Embedded Signup — takes about 2 minutes.
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { icon: '🔒', label: 'No BSP fee',      desc: 'Direct Meta API' },
          { icon: '⚡', label: '2-min setup',      desc: 'Embedded Signup' },
          { icon: '✅', label: 'Meta verified',    desc: 'Official partner' },
        ].map(f => (
          <div key={f.label} className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{f.icon}</div>
            <p className="text-xs font-semibold text-slate-700">{f.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={launchSignup}
        disabled={connecting || !fbReady}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition mb-3"
      >
        {connecting
          ? <><Loader2 className="w-5 h-5 animate-spin" /> Connecting…</>
          : !fbReady
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading…</>
            : <><MessageCircle className="w-5 h-5" /> Connect WhatsApp</>
        }
      </button>
      <button onClick={onSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition">
        <SkipForward className="w-4 h-4" /> I&apos;ll connect WhatsApp later
      </button>
    </div>
  )
}

// ─── Automations step ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, string> = {
  abandoned_cart:     'Hi {{name}}! You left something behind 🛒\nYour cart at {{shop_name}} is waiting. Complete your order → {{cart_url}}',
  cod_verification:   'Hi {{name}}! Please confirm your COD order #{{order_number}} for ₹{{amount}} at {{shop_name}}.\nReply YES to confirm or NO to cancel.',
  order_confirmation: 'Hi {{name}}! Your order #{{order_number}} at {{shop_name}} is confirmed ✅\nTrack it → {{order_url}}',
}

const AUTO_OPTIONS = [
  {
    key:   'abandoned_cart',
    icon:  ShoppingCart,
    label: 'Abandoned Cart Recovery',
    desc:  'Recover lost sales by messaging customers who didn\'t complete checkout. Avg 25–35% recovery rate.',
    color: 'text-orange-600', bg: 'bg-orange-100',
    recommended: true,
  },
  {
    key:   'cod_verification',
    icon:  Package,
    label: 'COD Confirmation',
    desc:  'Verify COD orders before dispatch. Reduces return-to-origin (RTO) losses by up to 40%.',
    color: 'text-purple-600', bg: 'bg-purple-100',
    recommended: true,
  },
  {
    key:   'order_confirmation',
    icon:  CheckCircle2,
    label: 'Order Confirmation',
    desc:  'Send an instant WhatsApp confirmation when a customer places an order.',
    color: 'text-green-600', bg: 'bg-green-100',
    recommended: false,
  },
]

function AutomationsStep({
  storeId, onNext, onSkip
}: {
  storeId: string | null
  onNext: () => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['abandoned_cart', 'cod_verification']))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const supabase = useMemo(() => createClient(), [])

  function toggle(key: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function handleEnable() {
    if (!storeId || selected.size === 0) { onNext(); return }
    setSaving(true)
    setError('')

    const rows = Array.from(selected).map(key => ({
      store_id:         storeId,
      type:             key,
      is_enabled:       true,
      template:         DEFAULT_TEMPLATES[key] ?? '',
      delay_minutes:    key === 'abandoned_cart' ? 30 : key === 'cod_verification' ? 5 : 0,
      discount_enabled: false,
      discount_value:   10,
    }))

    const { error: err } = await supabase
      .from('automations')
      .upsert(rows, { onConflict: 'store_id,type' })

    setSaving(false)
    if (err) { setError(err.message); return }
    onNext()
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Zap className="w-8 h-8 text-purple-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Enable automations</h2>
      <p className="text-slate-500 text-center mb-8 text-sm">
        Select the WhatsApp automations you want to activate. You can fine-tune templates anytime.
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-3 mb-8">
        {AUTO_OPTIONS.map(({ key, icon: Icon, label, desc, color, bg, recommended }) => {
          const on = selected.has(key)
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                'w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition',
                on ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', on ? bg : 'bg-slate-100')}>
                <Icon className={cn('w-5 h-5', on ? color : 'text-slate-400')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-semibold text-slate-800 text-sm">{label}</span>
                  {recommended && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Recommended</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition',
                on ? 'border-[#25D366] bg-[#25D366]' : 'border-slate-300'
              )}>
                {on && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={handleEnable}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition mb-3"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
        {saving ? 'Enabling…' : selected.size > 0 ? `Enable ${selected.size} automation${selected.size > 1 ? 's' : ''}` : 'Skip for now'}
      </button>
      <button onClick={onSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition">
        <SkipForward className="w-4 h-4" /> I&apos;ll do this later
      </button>
    </div>
  )
}

// ─── Lead-gen automations step ────────────────────────────────────────────────

function LeadAutomationsStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleEnable() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/settings/missed-call-followup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    setSaving(false)
    if (!res.ok) { setError('Could not save — please try again.'); return }
    onNext()
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Zap className="w-8 h-8 text-purple-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Enable automations</h2>
      <p className="text-slate-500 text-center mb-8 text-sm">
        Start with this — you can fine-tune per-source auto-replies once a lead source is connected.
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={() => setEnabled(e => !e)}
        className={cn(
          'w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition mb-4',
          enabled ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', enabled ? 'bg-emerald-100' : 'bg-slate-100')}>
          <Phone className={cn('w-5 h-5', enabled ? 'text-emerald-600' : 'text-slate-400')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-slate-800 text-sm">Missed Call Follow-up</span>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Recommended</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Automatically message a caller on WhatsApp if their call to you goes unanswered.</p>
        </div>
        <div className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition',
          enabled ? 'border-[#25D366] bg-[#25D366]' : 'border-slate-300'
        )}>
          {enabled && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </div>
      </button>

      <div className="bg-slate-50 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Want to auto-reply to new leads instantly? Once you connect Facebook Lead Ads or your
          website form, set up a custom reply for it in <span className="font-medium text-slate-600">Leads → Automations</span>.
        </p>
      </div>

      <button
        onClick={handleEnable}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition mb-3"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
        {saving ? 'Saving…' : enabled ? 'Enable & continue' : 'Continue'}
      </button>
      <button onClick={onSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition">
        <SkipForward className="w-4 h-4" /> I&apos;ll do this later
      </button>
    </div>
  )
}

// ─── Done step ────────────────────────────────────────────────────────────────

function DoneStep({
  businessType, storeConnected, automationCount, missedCallFollowupOn
}: {
  businessType: BusinessType | null
  storeConnected: boolean
  automationCount: number
  missedCallFollowupOn: boolean
}) {
  const router = useRouter()
  const isEcommerce = businessType === 'ecommerce'
  // For lead-gen, "automations" set up during onboarding is the Missed Call
  // Follow-up toggle — the ecommerce `automations` table count means nothing
  // here (it's a different table entirely), so checking automationCount for
  // this business type would show "None enabled" even right after someone
  // just turned Missed Call Follow-up on.
  const automationsOn = isEcommerce ? automationCount > 0 : missedCallFollowupOn
  const firstLineLabel = isEcommerce
    ? 'Connected and syncing'
    : (storeConnected ? 'Lead source connected' : 'Add leads in the Leads tab anytime')
  const automationsLabel = isEcommerce
    ? (automationCount > 0 ? `${automationCount} automation${automationCount > 1 ? 's' : ''} enabled` : 'None enabled yet — set up in Automations')
    : (missedCallFollowupOn ? 'Missed Call Follow-up is on' : 'Not enabled yet — set up in Automations')

  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-20 h-20 bg-[#25D366]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-bounce">
        <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re all set! 🎉</h1>
      <p className="text-slate-500 mb-8">
        {isEcommerce
          ? 'Wapaci is configured and ready to help you recover revenue with WhatsApp automations.'
          : 'Wapaci is configured and ready to help you capture and follow up with leads over WhatsApp.'}
      </p>

      {/* Summary */}
      <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-left space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', (isEcommerce ? storeConnected : true) ? 'bg-green-100' : 'bg-slate-100')}>
            <Store className={cn('w-4 h-4', (isEcommerce ? storeConnected : true) ? 'text-green-600' : 'text-slate-400')} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">{isEcommerce ? 'Store' : 'Leads'}</p>
            <p className="text-xs text-slate-500">{firstLineLabel}</p>
          </div>
          {(isEcommerce ? storeConnected : true) && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', automationsOn ? 'bg-green-100' : 'bg-slate-100')}>
            <Zap className={cn('w-4 h-4', automationsOn ? 'text-green-600' : 'text-slate-400')} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Automations</p>
            <p className="text-xs text-slate-500">{automationsLabel}</p>
          </div>
          {automationsOn && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-3.5 rounded-2xl transition text-base shadow-lg shadow-green-500/20 mb-4"
      >
        Go to Dashboard <ArrowRight className="w-5 h-5" />
      </button>

      <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
        <Link href="/dashboard/settings" className="hover:text-slate-600 flex items-center gap-1">
          Settings <ChevronRight className="w-3.5 h-3.5" />
        </Link>
        <Link href="/dashboard/automations" className="hover:text-slate-600 flex items-center gap-1">
          Automations <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ─── Main onboarding page ─────────────────────────────────────────────────────

function OnboardingContent() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep]           = useState<Step>('welcome')
  const [userEmail, setUserEmail] = useState('')
  const [storeId, setStoreId]     = useState<string | null>(null)
  const [storeConnected, setStoreConnected] = useState(false)
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [automationCount, setAutomationCount] = useState(0)
  const [missedCallFollowupOn, setMissedCallFollowupOn] = useState(false)
  const [loading, setLoading]     = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserEmail(user.email ?? '')

    let store = (await supabase
      .from('stores').select('id, shopify_domain, business_type')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle()).data

    // Signup itself doesn't provision a stores row (only /dashboard's own
    // fallback and team-invite acceptance do) — this page is now the first
    // screen that actually needs one (BusinessTypeStep PATCHes immediately),
    // so a genuinely fresh signup landing straight here would otherwise hit
    // "No store found" on the very first Continue click.
    if (!store) {
      const { data: profile } = await supabase
        .from('user_profiles').select('company_name').eq('id', user.id).maybeSingle()
      const shopName = profile?.company_name || (user.user_metadata?.company_name as string | undefined) || 'My Store'
      const { data: newStore } = await supabase
        .from('stores')
        .insert({ user_id: user.id, shop_name: shopName, is_active: true, whatsapp_bsp: 'mock', plan: 'starter' })
        .select('id, shopify_domain, business_type').single()
      if (newStore) {
        store = newStore
        await supabase.rpc('create_default_automations', { p_store_id: newStore.id })
      }
    }

    if (store) {
      setStoreId(store.id)
      // A bare stores row is auto-provisioned regardless of business type —
      // "connected" here must mean Shopify is actually linked, not merely
      // that the row exists, or this step's success screen shows for every
      // new user before they've connected anything.
      setStoreConnected(hasShopifyConnection(store))
      setBusinessType((store.business_type as BusinessType | null) ?? null)

      const { count } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_enabled', true)
      setAutomationCount(count ?? 0)
    }

    setLoading(false)
  }, [supabase, router])

  async function handleSelectBusinessType(type: BusinessType) {
    const res = await fetch('/api/settings/store', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_type: type }),
    })
    if (!res.ok) throw new Error('Failed to save business type')
    setBusinessType(type)
    next()
  }

  useEffect(() => {
    loadUser()
  }, [loadUser])

  // Resume step after Shopify OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const returnStep = localStorage.getItem('wapaci_onboarding_return') as Step | null
    const connected  = searchParams.get('connected')
    if (returnStep && connected) {
      localStorage.removeItem('wapaci_onboarding_return')
      setStep(returnStep)
    }
  }, [searchParams])

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      // Refresh store data when advancing past the connect step
      if (step === 'connect') loadUser()
      // DoneStep's summary needs the real current value for a lead-gen
      // account — LeadAutomationsStep writes it via a dedicated route, not
      // through loadUser's store-scoped queries.
      if (step === 'automations' && businessType !== 'ecommerce') {
        fetch('/api/settings/missed-call-followup')
          .then(r => r.json())
          .then((d: { enabled?: boolean }) => setMissedCallFollowupOn(!!d.enabled))
          .catch(() => {})
      }
      setStep(STEPS[idx + 1])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">Wapaci</span>
        </div>
        {step !== 'done' && (
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition"
          >
            Skip setup <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {step !== 'done' && step !== 'welcome' && <StepProgress current={step} />}

        {step === 'welcome' && (
          <WelcomeStep email={userEmail} onNext={next} />
        )}

        {step === 'business_type' && (
          <BusinessTypeStep
            initialValue={businessType}
            onSelect={handleSelectBusinessType}
          />
        )}

        {step === 'connect' && (
          businessType === 'ecommerce' ? (
            <ConnectStoreStep
              storeConnected={storeConnected}
              onNext={next}
              onSkip={next}
            />
          ) : (
            <ConnectLeadSourceStep onNext={next} />
          )
        )}

        {step === 'whatsapp' && (
          <WhatsAppStep
            storeId={storeId}
            onNext={next}
            onSkip={next}
          />
        )}

        {step === 'automations' && (
          businessType === 'ecommerce' ? (
            <AutomationsStep
              storeId={storeId}
              onNext={next}
              onSkip={next}
            />
          ) : (
            <LeadAutomationsStep onNext={next} onSkip={next} />
          )
        )}

        {step === 'done' && (
          <DoneStep
            businessType={businessType}
            storeConnected={storeConnected}
            automationCount={automationCount}
            missedCallFollowupOn={missedCallFollowupOn}
          />
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}

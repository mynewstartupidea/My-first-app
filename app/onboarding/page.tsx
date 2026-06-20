'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, ArrowRight, Loader2, AlertCircle,
  Store, MessageCircle, Zap, ShoppingCart, Package,
  Sparkles, SkipForward, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'

type Step = 'welcome' | 'connect_store' | 'whatsapp' | 'automations' | 'done'

const STEPS: Step[] = ['welcome', 'connect_store', 'whatsapp', 'automations', 'done']

const STEP_META: Record<Step, { title: string; sub: string }> = {
  welcome:       { title: 'Welcome',        sub: 'Get started'       },
  connect_store: { title: 'Connect Store',  sub: 'Link your store'   },
  whatsapp:      { title: 'WhatsApp',       sub: 'Set up messaging'  },
  automations:   { title: 'Automations',    sub: 'Enable flows'      },
  done:          { title: 'All Set!',       sub: 'You\'re ready'     },
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  const visible = STEPS.slice(0, -1) // exclude 'done' from dots

  return (
    <div className="flex items-center gap-2 mb-10">
      {visible.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            idx > i  ? 'bg-[#25D366] text-white'
            : idx === i ? 'bg-[#25D366] text-white ring-4 ring-[#25D366]/20'
            : 'bg-slate-100 text-slate-400'
          )}>
            {idx > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs font-medium hidden sm:block',
            idx >= i ? 'text-slate-700' : 'text-slate-400'
          )}>
            {STEP_META[s].title}
          </span>
          {i < visible.length - 1 && (
            <div className={cn('w-8 h-0.5 rounded-full', idx > i ? 'bg-[#25D366]' : 'bg-slate-200')} />
          )}
        </div>
      ))}
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
          { icon: Store,         text: 'Connect your Shopify or WooCommerce store' },
          { icon: MessageCircle, text: 'Link your WhatsApp Business account'         },
          { icon: Zap,           text: 'Enable abandoned cart & COD automations'     },
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
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
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

// ─── WhatsApp step ────────────────────────────────────────────────────────────

function WhatsAppStep({
  storeId, onNext, onSkip
}: {
  storeId: string | null
  onNext: () => void
  onSkip: () => void
}) {
  const [saving, setSaving] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function handleSave() {
    if (!storeId) { onNext(); return }
    setSaving(true)
    await supabase.from('stores').update({
      whatsapp_bsp: 'meta',
      updated_at:   new Date().toISOString(),
    }).eq('id', storeId)
    setSaving(false)
    onNext()
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <MessageCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Connect WhatsApp</h2>
      <p className="text-slate-500 text-center mb-8 text-sm">
        Wapaci uses the WhatsApp Cloud API directly — no third-party provider needed.
      </p>

      {/* Info card */}
      <div className="bg-[#25D366]/8 border border-[#25D366]/20 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-[#25D366]/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm mb-1">Official Meta WhatsApp API</p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Wapaci connects directly to the WhatsApp Cloud API via Meta Embedded Signup.
              You&apos;ll link your WhatsApp Business number in <strong>Settings → WhatsApp</strong> right after this — it only takes 2 minutes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { icon: '🔒', label: 'No BSP needed',      desc: 'Direct Meta API' },
          { icon: '⚡', label: '2-min setup',         desc: 'Embedded Signup' },
          { icon: '✅', label: 'Meta verified',       desc: 'Official partner' },
        ].map(f => (
          <div key={f.label} className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{f.icon}</div>
            <p className="text-xs font-semibold text-slate-700">{f.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition mb-3"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        {saving ? 'Saving…' : 'Got it — Continue'}
      </button>
      <button onClick={onSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition">
        <SkipForward className="w-4 h-4" /> I&apos;ll configure this later
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

// ─── Done step ────────────────────────────────────────────────────────────────

function DoneStep({ storeConnected, automationCount }: { storeConnected: boolean; automationCount: number }) {
  const router = useRouter()
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-20 h-20 bg-[#25D366]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-bounce">
        <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re all set! 🎉</h1>
      <p className="text-slate-500 mb-8">
        Wapaci is configured and ready to help you recover revenue with WhatsApp automations.
      </p>

      {/* Summary */}
      <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-left space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', storeConnected ? 'bg-green-100' : 'bg-slate-100')}>
            <Store className={cn('w-4 h-4', storeConnected ? 'text-green-600' : 'text-slate-400')} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Store</p>
            <p className="text-xs text-slate-500">{storeConnected ? 'Connected and syncing' : 'Not connected yet — set up in Settings'}</p>
          </div>
          {storeConnected && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', automationCount > 0 ? 'bg-green-100' : 'bg-slate-100')}>
            <Zap className={cn('w-4 h-4', automationCount > 0 ? 'text-green-600' : 'text-slate-400')} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Automations</p>
            <p className="text-xs text-slate-500">
              {automationCount > 0 ? `${automationCount} automation${automationCount > 1 ? 's' : ''} enabled` : 'None enabled yet — set up in Automations'}
            </p>
          </div>
          {automationCount > 0 && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
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
  const [automationCount, setAutomationCount] = useState(0)
  const [loading, setLoading]     = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserEmail(user.email ?? '')

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()

    if (store) {
      setStoreId(store.id)
      setStoreConnected(true)

      const { count } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_enabled', true)
      setAutomationCount(count ?? 0)
    }

    setLoading(false)
  }, [supabase, router])

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
      // Refresh store data when advancing past connect_store
      if (step === 'connect_store') loadUser()
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

      <div className="max-w-xl mx-auto px-6 py-12">
        {step !== 'done' && step !== 'welcome' && <StepProgress current={step} />}

        {step === 'welcome' && (
          <WelcomeStep email={userEmail} onNext={next} />
        )}

        {step === 'connect_store' && (
          <ConnectStoreStep
            storeConnected={storeConnected}
            onNext={next}
            onSkip={next}
          />
        )}

        {step === 'whatsapp' && (
          <WhatsAppStep
            storeId={storeId}
            onNext={next}
            onSkip={next}
          />
        )}

        {step === 'automations' && (
          <AutomationsStep
            storeId={storeId}
            onNext={next}
            onSkip={next}
          />
        )}

        {step === 'done' && (
          <DoneStep
            storeConnected={storeConnected}
            automationCount={automationCount}
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

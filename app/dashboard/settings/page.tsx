'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Store, MessageCircle, Loader2, Save, CheckCircle2,
  AlertCircle, ExternalLink, Trash2, Info, ChevronDown, ChevronUp,
  CreditCard, Users, Shield, Crown, Zap, TrendingUp,
  UserPlus, Trash, Mail, Lock, RefreshCw, XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store as StoreType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingStatus {
  plan_name: string
  status: string
  messages_limit: number
  messages_used: number
  messages_remaining: number
  next_billing_date: string | null
  current_period_end: string | null
  razorpay_subscription_id: string | null
  amount_paise: number
  cancelled_at: string | null
}

interface TeamMember {
  id: string
  email: string
  role: string
  status: 'pending' | 'active'
  invited_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────


const SHOPIFY_ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: 'OAuth callback was invalid. Please try connecting again.',
  invalid_state:    'Security state mismatch. Please try connecting again.',
  oauth_failed:     'Could not connect to Shopify. Check your app credentials in Vercel.',
  not_configured:   'Shopify app credentials are not configured yet. Follow the setup guide below.',
}

const PLAN_META = {
  trial:   { label: 'Free Trial',   price: '₹0/mo',      msgs: '500 messages/mo',   color: 'text-slate-600', bg: 'bg-slate-100',   amount: 0      },
  starter: { label: 'Starter',      price: '₹999/mo',    msgs: '500 messages/mo',   color: 'text-blue-600',  bg: 'bg-blue-100',    amount: 99900  },
  growth:  { label: 'Growth',       price: '₹2,999/mo',  msgs: '5,000 messages/mo', color: 'text-green-600', bg: 'bg-green-100',   amount: 299900 },
  pro:     { label: 'Pro',          price: '₹7,999/mo',  msgs: '25,000 messages/mo',color: 'text-purple-600',bg: 'bg-purple-100',  amount: 799900 },
} as const

type PlanKey = keyof typeof PLAN_META

const STATUS_META: Record<string, { label: string; color: string }> = {
  trialing:  { label: 'Trial',     color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  past_due:  { label: 'Past Due',  color: 'bg-amber-100 text-amber-700' },
  expired:   { label: 'Expired',   color: 'bg-slate-100 text-slate-600' },
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-[#25D366]/10 text-[#25D366]',
  admin:   'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  member:  'bg-slate-100 text-slate-600',
  support: 'bg-amber-100 text-amber-700',
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams()

  // Store / WhatsApp
  const [store, setStore]                     = useState<StoreType | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [shopifyDomain, setShopifyDomain]     = useState('')
  const [connecting, setConnecting]           = useState(false)
  const [savingWA, setSavingWA]               = useState(false)
  const [savingStore, setSavingStore]         = useState(false)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [waNumber, setWaNumber]               = useState('')
  const [waApiKey, setWaApiKey]               = useState('')
  const [storeNameEdit, setStoreNameEdit]     = useState('')
  const [showGuide, setShowGuide]             = useState(false)

  // WhatsApp test message
  const [testPhone, setTestPhone]             = useState('')
  const [testMsg, setTestMsg]                 = useState('')
  const [sendingTest, setSendingTest]         = useState(false)
  const [waConnected, setWaConnected]         = useState(false)
  const [waDisplayPhone, setWaDisplayPhone]   = useState('')
  const [waTokenType, setWaTokenType]         = useState<'user_token' | 'system_user_token' | null>(null)
  const [showSysUserGuide, setShowSysUserGuide] = useState(false)
  const [fbReady, setFbReady]                 = useState(false)
  const [connectingMeta, setConnectingMeta]   = useState(false)
  const [scopeError, setScopeError]           = useState<string | null>(null)
  const [showManual, setShowManual]           = useState(false)
  const [manualWabaId, setManualWabaId]       = useState('')
  const [manualPhoneId, setManualPhoneId]     = useState('')
  const [manualToken, setManualToken]         = useState('')
  const [savingManual, setSavingManual]       = useState(false)

  // Account
  const [userEmail, setUserEmail]             = useState('')

  // UI
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab]             = useState<'account' | 'store' | 'whatsapp' | 'billing' | 'team' | 'security'>('account')

  // Billing
  const [billing, setBilling]                 = useState<BillingStatus | null>(null)
  const [loadingBilling, setLoadingBilling]   = useState(false)
  const [subscribing, setSubscribing]         = useState<string | null>(null)
  const [cancelling, setCancelling]           = useState(false)

  // Team
  const [members, setMembers]                 = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers]   = useState(false)
  const [inviteEmail, setInviteEmail]         = useState('')
  const [inviteRole, setInviteRole]           = useState('member')
  const [sendingInvite, setSendingInvite]     = useState(false)
  const [removingId, setRemovingId]           = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const urlError   = searchParams.get('error')
  const urlSuccess = searchParams.get('connected')

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }, [])

  // ── Load store + WhatsApp ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserEmail(user.email ?? '')
    const { data: sRows } = await supabase
      .from('stores').select('*').eq('user_id', user.id).eq('is_active', true)
      .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1)
    const s = sRows?.[0] ?? null
    if (s) {
      setStore(s)
      setStoreNameEdit(s.shop_name ?? '')
      setWaNumber(s.whatsapp_number ?? '')
      setWaApiKey(s.whatsapp_api_key ?? '')
    }

    // Load WhatsApp account (for Meta status + token type)
    const { data: wa } = await supabase
      .from('whatsapp_accounts')
      .select('status, display_phone_number, token_type')
      .eq('user_id', user.id)
      .maybeSingle()
    if (wa) {
      setWaConnected(wa.status === 'connected')
      setWaDisplayPhone(wa.display_phone_number ?? '')
      setWaTokenType((wa.token_type as 'user_token' | 'system_user_token') ?? 'user_token')
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── Load Facebook JS SDK for Embedded Signup ──────────────────────────────
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    if (!appId || typeof window === 'undefined') return

    const w = window as unknown as { FB?: { init: (o: object) => void }; fbAsyncInit?: () => void }
    if (w.FB) { setFbReady(true); return }

    w.fbAsyncInit = function () {
      w.FB!.init({ appId, version: 'v22.0', xfbml: false, status: false })
      setFbReady(true)
    }

    if (!document.getElementById('fb-jssdk')) {
      const s = document.createElement('script')
      s.id    = 'fb-jssdk'
      s.src   = 'https://connect.facebook.net/en_US/sdk.js'
      s.async = true
      s.defer = true
      ;(s as HTMLScriptElement & { crossOrigin: string }).crossOrigin = 'anonymous'
      document.head.appendChild(s)
    }
  }, [])

  const urlTab = searchParams.get('tab')

  useEffect(() => {
    if (urlTab === 'whatsapp') setActiveTab('whatsapp')
  }, [urlTab])

  useEffect(() => {
    const connected = searchParams.get('connected')
    const err       = searchParams.get('error')
    if (connected === 'meta') {
      showToast('WhatsApp connected via Meta!')
      setActiveTab('whatsapp')
      loadData()
    } else if (connected === 'connected' || urlSuccess) {
      showToast('Shopify store connected successfully!')
      loadData()
    }
    if (urlError) showToast(SHOPIFY_ERROR_MESSAGES[urlError] ?? 'Something went wrong.', false)
    if (err) showToast(decodeURIComponent(err), false)
  }, [urlError, urlSuccess, showToast, searchParams, loadData])

  // ── Load billing ──────────────────────────────────────────────────────────────
  const loadBilling = useCallback(async () => {
    setLoadingBilling(true)
    const res = await fetch('/api/billing/status')
    if (res.ok) setBilling(await res.json())
    setLoadingBilling(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'billing') loadBilling()
  }, [activeTab, loadBilling])

  // ── Load team members ─────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    const res = await fetch('/api/team/members')
    if (res.ok) {
      const { members: m } = await res.json()
      setMembers(m ?? [])
    }
    setLoadingMembers(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'team') loadMembers()
  }, [activeTab, loadMembers])

  // ── Store actions ─────────────────────────────────────────────────────────────
  async function handleConnectShopify() {
    if (!shopifyDomain.trim()) return
    let domain = shopifyDomain.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`
    setConnecting(true)
    try {
      const res = await fetch(`/api/shopify/install?shop=${domain}`, { redirect: 'manual' })
      if (res.type === 'opaqueredirect' || res.status === 0 || (res.status >= 300 && res.status < 400)) {
        window.location.href = `/api/shopify/install?shop=${domain}`
        return
      }
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
      .update({ whatsapp_number: waNumber || null, whatsapp_bsp: 'meta', whatsapp_api_key: waApiKey || null, updated_at: new Date().toISOString() })
      .eq('id', store.id)
    setSavingWA(false)
    if (error) { showToast('Failed to save settings', false); return }
    showToast('WhatsApp settings saved!')
  }

  async function saveStoreName() {
    if (!store || !storeNameEdit.trim()) return
    setSavingStore(true)
    const { error } = await supabase
      .from('stores')
      .update({ shop_name: storeNameEdit.trim(), updated_at: new Date().toISOString() })
      .eq('id', store.id)
    setSavingStore(false)
    if (error) { showToast('Failed to save store name', false); return }
    setStore(prev => prev ? { ...prev, shop_name: storeNameEdit.trim() } : prev)
    showToast('Store name saved!')
  }

  async function disconnectStore() {
    if (!store) return
    if (!confirm(`Disconnect ${store.shop_name ?? store.shopify_domain ?? 'this store'}? All automations will stop.`)) return
    await supabase.from('stores').update({ is_active: false }).eq('id', store.id)
    setStore(null)
    showToast('Store disconnected')
  }

  async function syncProducts() {
    if (!store?.shopify_domain) return
    setSyncingProducts(true)
    const res  = await fetch('/api/shopify/sync-products', { method: 'POST' })
    const data = await res.json() as { count?: number; error?: string }
    setSyncingProducts(false)
    if (res.ok && data.count !== undefined) {
      showToast(`${data.count} product${data.count !== 1 ? 's' : ''} found in your store`)
      setStore(prev => prev ? { ...prev, product_count: data.count! } : prev)
    } else {
      showToast(data.error ?? 'Sync failed', false)
    }
  }

// ── WhatsApp test message ─────────────────────────────────────────────────────
  async function sendTestWhatsApp() {
    if (!testPhone.trim()) return
    setSendingTest(true)
    const res  = await fetch('/api/whatsapp/test', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: testPhone.trim() }),
    })
    const data = await res.json() as { success: boolean; messageId?: string; error?: string; phone?: string }
    setSendingTest(false)
    if (data.success) {
      showToast(`✓ Message sent to ${data.phone ?? testPhone.trim()}${data.messageId ? ` (ID: ${data.messageId.slice(0, 16)}…)` : ''}`)
    } else {
      showToast(data.error ?? 'Send failed', false)
    }
  }

  // ── Meta Embedded Signup — launch FB.login() popup ───────────────────────────
  function launchEmbeddedSignup() {
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID
    const appId    = process.env.NEXT_PUBLIC_META_APP_ID

    if (!appId) { showToast('META_APP_ID not configured', false); return }

    const w  = window as unknown as { FB?: { login: (cb: (r: { authResponse?: { code?: string } | null; status?: string }) => void, opts: object) => void } }
    const FB = w.FB

    if (!FB) { showToast('Facebook SDK not loaded — refresh and try again.', false); return }

    if (!configId) {
      showToast('Embedded Signup not configured. NEXT_PUBLIC_META_CONFIG_ID is missing.', false)
      return
    }

    // ── Debug: print full SDK config before launching ──────────────────────────
    const fbLoginOpts = {
      config_id:                      configId,
      response_type:                  'code',
      override_default_response_type: true,
      extras:                         { sessionInfoVersion: 2 },
    }
    console.group('[Wapaci] Meta Embedded Signup — debug info')
    console.log('APP_ID (NEXT_PUBLIC_META_APP_ID):', appId)
    console.log('CONFIG_ID (NEXT_PUBLIC_META_CONFIG_ID):', configId)
    console.log('Flow type: FB JS SDK popup (no redirect_uri — code POSTed to /api/meta/callback)')
    console.log('Scopes: defined in Meta config_id, not in client code')
    console.log('FB.login() options:', JSON.stringify(fbLoginOpts, null, 2))
    console.log('SDK version: v22.0 | status: false | xfbml: false')
    console.log('Origin:', window.location.origin)
    console.groupEnd()
    // ── End debug ──────────────────────────────────────────────────────────────

    setConnectingMeta(true)

    // Safety timeout — reset spinner if FB never fires the callback (popup blocked, SDK error)
    const timeoutId = setTimeout(() => {
      console.warn('[Wapaci] FB.login timeout — resetting state')
      setConnectingMeta(false)
      showToast('Connection timed out. Please try again.', false)
    }, 5 * 60 * 1000)

    FB.login((response) => {
      console.log('[Wapaci] FB.login raw response:', JSON.stringify(response, null, 2))
      clearTimeout(timeoutId)

      const authResponse = response.authResponse as unknown as {
        code?: string
        sessionInfo?: {
          sessionInfoVersion?: number
          source?: string
          businessID?: string
          businessName?: string
          wabaID?: string
          wabaName?: string
          phoneNumberID?: string
          displayPhoneNumber?: string
        }
      } | null

      const code        = authResponse?.code
      const sessionInfo = authResponse?.sessionInfo

      console.log('[Wapaci] sessionInfo from Embedded Signup:', JSON.stringify(sessionInfo ?? null, null, 2))

      // No code = user cancelled, closed popup, or Meta returned an error
      if (!code) {
        setConnectingMeta(false)
        const status = response.status ?? ''
        // 'unknown' = user closed without completing; don't show an error for that
        if (status !== 'unknown' && status !== '') {
          showToast(`Meta sign-in cancelled (status: ${status})`, false)
        }
        return
      }

      // Got a code — exchange it server-side, pass sessionInfo so server can
      // skip /me/businesses entirely (sessionInfo already has WABA + phone IDs)
      console.log('[Wapaci] received code, posting to /api/meta/callback, sessionInfo present:', !!sessionInfo)
      fetch('/api/meta/callback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, sessionInfo }),
      })
        .then(r => r.json())
        .then((data: { ok: boolean; phone?: string; error?: string; debug?: Record<string, unknown> }) => {
          // Always log the full debug payload so it's visible in browser console
          console.group('[Wapaci] Meta callback result')
          console.log('ok:', data.ok)
          console.log('phone:', data.phone ?? '(none)')
          console.log('error:', data.error ?? '(none)')
          if (data.debug) {
            console.log('granted_scopes:', data.debug.granted_scopes)
            console.log('has_business_management:', data.debug.has_business_management)
            console.log('has_whatsapp_business_management:', data.debug.has_whatsapp_business_management)
            console.log('has_whatsapp_business_messaging:', data.debug.has_whatsapp_business_messaging)
            console.log('businesses_returned:', data.debug.businesses_returned)
            console.log('business_ids:', data.debug.business_ids)
            console.log('waba_counts:', data.debug.waba_counts)
            console.log('config_id_env:', data.debug.config_id_env)
          }
          console.groupEnd()

          if (data.ok) {
            setScopeError(null)
            showToast(`WhatsApp connected! ${data.phone ? `Number: ${data.phone}` : ''}`)
            loadData()
          } else {
            const errMsg = data.error ?? 'Could not connect WhatsApp'
            setScopeError(errMsg)
          }
        })
        .catch((err: unknown) => {
          console.error('[Wapaci] callback fetch error:', err)
          showToast('Connection failed — server error. Please try again.', false)
        })
        .finally(() => {
          setConnectingMeta(false)
        })
    }, fbLoginOpts)
  }

  // ── Manual Meta connect fallback ─────────────────────────────────────────────
  async function saveManualConnect() {
    if (!manualWabaId.trim() || !manualPhoneId.trim() || !manualToken.trim()) return
    setSavingManual(true)
    const res  = await fetch('/api/meta/manual-connect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ wabaId: manualWabaId.trim(), phoneNumberId: manualPhoneId.trim(), accessToken: manualToken.trim() }),
    })
    const data = await res.json() as { ok: boolean; phone?: string; error?: string }
    setSavingManual(false)
    if (data.ok) {
      setScopeError(null)
      setShowManual(false)
      showToast(`WhatsApp connected! Number: ${data.phone ?? ''}`)
      loadData()
    } else {
      showToast(data.error ?? 'Manual connect failed', false)
    }
  }

  // ── Disconnect Meta WhatsApp ───────────────────────────────────────────────────
  async function disconnectMeta() {
    if (!confirm('Disconnect WhatsApp? Your automations will stop sending real messages.')) return
    const res = await fetch('/api/meta/disconnect', { method: 'POST' })
    if (res.ok) {
      setWaConnected(false)
      setWaDisplayPhone('')
      setWaTokenType(null)
      setShowSysUserGuide(false)
      showToast('WhatsApp disconnected')
      await loadData()
    } else {
      showToast('Failed to disconnect', false)
    }
  }

  // ── Billing actions ───────────────────────────────────────────────────────────
  async function handleSubscribe(plan: string) {
    setSubscribing(plan)
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSubscribing(null)
      showToast(data.error ?? 'Failed to start subscription', false)
      return
    }

    // Load Razorpay.js if not already loaded
    await new Promise<void>((resolve) => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve()
      script.onerror = () => resolve()
      document.head.appendChild(script)
    })

    const RazorpayClass = (window as unknown as { Razorpay?: new (opts: unknown) => { open(): void } }).Razorpay
    if (!RazorpayClass) {
      setSubscribing(null)
      showToast('Could not load payment gateway. Check your connection.', false)
      return
    }

    const rzp = new RazorpayClass({
      key:             data.key_id,
      subscription_id: data.subscription_id,
      name:            'Wapaci',
      description:     `${data.label} Plan – Monthly`,
      image:           '/logo.png',
      handler:         async () => {
        showToast('Payment successful! Activating your plan…')
        await loadBilling()
      },
      prefill:         { email: userEmail },
      theme:           { color: '#25D366' },
      modal: {
        ondismiss: () => setSubscribing(null),
      },
    })
    rzp.open()
    setSubscribing(null)
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription? You keep access until the end of this billing period.')) return
    setCancelling(true)
    const res = await fetch('/api/billing/cancel', { method: 'POST' })
    const data = await res.json()
    setCancelling(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to cancel', false); return }
    showToast('Subscription cancelled. Access continues until period end.')
    await loadBilling()
  }

  // ── Team actions ──────────────────────────────────────────────────────────────
  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setSendingInvite(true)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const data = await res.json()
    setSendingInvite(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to send invite', false); return }
    setInviteEmail('')
    if (data.warning) {
      showToast(data.warning, false)
    } else {
      showToast(`Invite email sent to ${data.invite.email}`)
    }
    await loadMembers()
  }

  async function handleRemoveMember(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team?`)) return
    setRemovingId(id)
    const res = await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    setRemovingId(null)
    if (!res.ok) { showToast(data.error ?? 'Failed to remove member', false); return }
    showToast('Member removed')
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  const currentPlan = (billing?.plan_name ?? 'trial') as PlanKey
  const planMeta = PLAN_META[currentPlan] ?? PLAN_META.trial
  const statusMeta = STATUS_META[billing?.status ?? 'trialing'] ?? STATUS_META.trialing
  const usagePct = billing ? Math.min(100, Math.round((billing.messages_used / billing.messages_limit) * 100)) : 0

  const TABS = [
    { id: 'account',  label: 'Account',   icon: Store       },
    { id: 'store',    label: 'Store',      icon: Store       },
    { id: 'whatsapp', label: 'WhatsApp',   icon: MessageCircle },
    { id: 'billing',  label: 'Billing',    icon: CreditCard  },
    { id: 'team',     label: 'Team',       icon: Users       },
    { id: 'security', label: 'Security',   icon: Shield      },
  ] as const

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
              activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
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
            <p className="text-slate-400 text-xs">Account email · {planMeta.label} plan</p>
          </div>
        </div>
      </section>

      {/* ── Ecommerce Store ──────────────────────────────────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5', activeTab !== 'store' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-green-600" />
          </div>
          Ecommerce Store
        </h2>

        {store ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">{store.shop_name ?? store.shopify_domain ?? 'My Store'}</p>
                  <p className="text-green-600 text-sm">
                    {store.shopify_domain
                      ? store.shopify_domain
                      : <span className="italic text-green-500">Mock store — no Shopify connected</span>}
                  </p>
                  {store.platform && (
                    <span className="inline-block mt-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">
                      🛍️ {store.platform}
                    </span>
                  )}
                  {store.connected_at && (
                    <p className="text-green-500 text-xs mt-0.5">
                      Connected {new Date(store.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {(store.product_count ?? 0) > 0 && (
                    <p className="text-green-500 text-xs mt-0.5">{store.product_count} products synced</p>
                  )}
                </div>
              </div>
              {store.shopify_domain && (
                <a href={`https://${store.shopify_domain}/admin`} target="_blank" rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-100 transition">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Store display name</label>
              <div className="flex gap-2">
                <input value={storeNameEdit} onChange={e => setStoreNameEdit(e.target.value)} placeholder="My Store"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                <button onClick={saveStoreName} disabled={savingStore || !storeNameEdit.trim()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                  {savingStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
              </div>
            </div>

            {!store.shopify_domain && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Connect Shopify (optional)</p>
                <div className="flex gap-2">
                  <input value={shopifyDomain} onChange={e => setShopifyDomain(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConnectShopify()}
                    placeholder="yourstore.myshopify.com"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                  <button onClick={handleConnectShopify} disabled={connecting || !shopifyDomain.trim()}
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition">
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {store.shopify_domain && (
                <button onClick={syncProducts} disabled={syncingProducts}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-xl transition border border-blue-200">
                  {syncingProducts
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                    : <><RefreshCw className="w-3.5 h-3.5" /> Sync Products</>}
                </button>
              )}
              <button onClick={disconnectStore}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition">
                <Trash2 className="w-3.5 h-3.5" /> Disconnect store
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Shopify domain</label>
              <div className="flex gap-2">
                <input value={shopifyDomain} onChange={e => setShopifyDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectShopify()}
                  placeholder="yourstore.myshopify.com"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                <button onClick={handleConnectShopify} disabled={connecting || !shopifyDomain.trim()}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>

            <button onClick={() => setShowGuide(v => !v)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <Info className="w-3.5 h-3.5" />
              {showGuide ? 'Hide' : 'Show'} Shopify setup guide
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showGuide && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm space-y-3">
                <p className="font-semibold text-slate-800">Connect Shopify (~10 min)</p>
                {[
                  { step: '1', title: 'Create Shopify Partner account', desc: 'Go to partners.shopify.com', href: 'https://partners.shopify.com', cta: 'Open Shopify Partners →' },
                  { step: '2', title: 'Create a custom app', desc: 'Partners → Apps → Create app → Custom app. Set redirect URL:', code: 'https://app.wapaci.com/api/shopify/callback' },
                  { step: '3', title: 'Copy API credentials', desc: 'From your app\'s API credentials tab.' },
                  { step: '4', title: 'Add to Vercel', desc: 'Vercel → Settings → Environment Variables:', envVars: ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'] },
                  { step: '5', title: 'Redeploy & connect', desc: 'Trigger a Vercel redeploy, then come back and connect.' },
                ].map(({ step, title, desc, code, envVars, href, cta }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step}</div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                      {code && <code className="block mt-1 text-[10px] bg-slate-200 px-2 py-1 rounded font-mono break-all">{code}</code>}
                      {envVars?.map(v => <code key={v} className="block mt-1 text-[10px] bg-slate-200 px-2 py-1 rounded font-mono">{v}</code>)}
                      {href && cta && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs text-[#25D366] hover:underline">{cta}</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── WhatsApp ─────────────────────────────────────────────────────────── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-5">
          {/* Meta connection status */}
          {waConnected ? (
            <section className="bg-white rounded-2xl shadow-sm border border-[#25D366]/30 p-6">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                </div>
                WhatsApp Connected
              </h2>

              {/* Connected number row */}
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Meta WhatsApp Cloud API</p>
                    <p className="text-green-600 text-sm">{waDisplayPhone || 'Number connected'}</p>
                    {waTokenType === 'system_user_token' && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Permanent system token
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Live
                </span>
              </div>

              {/* Token expiry warning — shown only when using temporary user token */}
              {waTokenType === 'user_token' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-800 font-semibold text-sm">Temporary token — expires in ~60 days</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Your WhatsApp connection uses a User Access Token which expires. After expiry,
                        all message sending will silently fail. Set up a System User token to fix this permanently.
                      </p>
                      <button
                        onClick={() => setShowSysUserGuide(v => !v)}
                        className="mt-2 text-amber-800 text-xs font-semibold underline underline-offset-2 flex items-center gap-1"
                      >
                        {showSysUserGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showSysUserGuide ? 'Hide' : 'Show'} System User setup (5 min)
                      </button>

                      {showSysUserGuide && (
                        <div className="mt-3 bg-white border border-amber-200 rounded-xl p-4 space-y-4 text-xs">
                          <p className="font-semibold text-slate-800 text-sm">Set up a permanent System User token</p>

                          {[
                            {
                              step: '1',
                              title: 'Open Meta Business Manager',
                              desc: 'Go to business.facebook.com → Business Settings → Users → System Users.',
                            },
                            {
                              step: '2',
                              title: 'Create a System User',
                              desc: 'Click Add → name it "Wapaci Platform" → set role to Admin → click Create System User.',
                            },
                            {
                              step: '3',
                              title: 'Copy the System User numeric ID',
                              desc: 'In System Users list, click on your new user. Copy the numeric ID from the URL (e.g. business.facebook.com/settings/system-users/1234567890). This is your META_SYSTEM_USER_ID.',
                            },
                            {
                              step: '4',
                              title: 'Generate a System User Access Token',
                              desc: 'From the System User page, click Generate New Token → select your Wapaci app → tick whatsapp_business_management and whatsapp_business_messaging → click Generate Token. Copy it — this is META_SYSTEM_USER_ACCESS_TOKEN.',
                            },
                            {
                              step: '5',
                              title: 'Add both to Vercel & reconnect',
                              desc: 'In Vercel → Settings → Environment Variables, add:',
                              vars: ['META_SYSTEM_USER_ID', 'META_SYSTEM_USER_ACCESS_TOKEN'],
                              note: 'Trigger a Vercel redeploy, then click Disconnect WhatsApp below and reconnect. The next Embedded Signup will assign the System User to each merchant WABA and record token_type = system_user_token.',
                            },
                          ].map(({ step, title, desc, vars, note }) => (
                            <div key={step} className="flex gap-3">
                              <div className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                {step}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{title}</p>
                                <p className="text-slate-500 mt-0.5">{desc}</p>
                                {vars?.map(v => (
                                  <code key={v} className="block mt-1 text-[10px] bg-slate-100 px-2 py-1 rounded font-mono">{v}</code>
                                ))}
                                {note && <p className="text-slate-400 mt-1.5 italic">{note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={disconnectMeta}
                className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5" /> Disconnect WhatsApp
              </button>
            </section>
          ) : (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                </div>
                Connect WhatsApp Number
              </h2>
              <p className="text-slate-400 text-xs mb-5 ml-9">Choose how to connect your WhatsApp Business number</p>

              {/* Option 1: Meta Cloud API */}
              <div className="bg-gradient-to-br from-blue-50 to-[#25D366]/5 border border-blue-200 rounded-2xl p-5 mb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                    <span className="text-2xl">💬</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Meta WhatsApp Cloud API</p>
                    <p className="text-slate-500 text-xs mt-0.5">Official Meta Business API — direct connection, no third-party required</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Official API</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">✓ One-click setup</span>
                    </div>
                  </div>
                </div>
                {!process.env.NEXT_PUBLIC_META_APP_ID ? (
                  <div className="flex items-start gap-2 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Meta app not configured. Add <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_META_APP_ID</code> and <code className="bg-amber-100 px-1 rounded">META_APP_SECRET</code> to your Vercel environment variables.</span>
                  </div>
                ) : !process.env.NEXT_PUBLIC_META_CONFIG_ID ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Embedded Signup not configured. <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_META_CONFIG_ID</code> is missing.</p>
                        <p>In Meta Developer Console → Your App → WhatsApp → Configuration → Embedded Signup → Create a configuration. Copy the config_id and add it to Vercel.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scopeError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="font-semibold text-red-800">Auto-connect failed</p>
                          </div>
                          <button onClick={() => { setScopeError(null); setShowManual(false) }} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">Dismiss</button>
                        </div>
                        <p className="text-red-700 text-xs leading-relaxed">{scopeError}</p>
                        <button
                          onClick={() => setShowManual(v => !v)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                        >
                          {showManual ? 'Hide manual setup' : 'Try manual setup instead →'}
                        </button>
                      </div>
                    )}

                    {showManual && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 mb-0.5">Manual WhatsApp Setup</p>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Go to <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">business.facebook.com → WhatsApp Manager</a>. Your WABA ID and Phone Number ID are visible in the URL and on the account page.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">WABA ID <span className="text-slate-400">(WhatsApp Business Account ID)</span></label>
                          <input value={manualWabaId} onChange={e => setManualWabaId(e.target.value)}
                            placeholder="e.g. 123456789012345"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number ID</label>
                          <input value={manualPhoneId} onChange={e => setManualPhoneId(e.target.value)}
                            placeholder="e.g. 987654321098765"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Permanent Access Token <span className="text-slate-400">(from Meta System User)</span></label>
                          <input value={manualToken} onChange={e => setManualToken(e.target.value)}
                            type="password"
                            placeholder="EAAxxxxxxx…"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                          <p className="text-[10px] text-slate-400 mt-1">Get a permanent token: Meta Business Manager → System Users → Generate Token → select your WABA</p>
                        </div>
                        <button
                          onClick={saveManualConnect}
                          disabled={savingManual || !manualWabaId.trim() || !manualPhoneId.trim() || !manualToken.trim()}
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
                        >
                          {savingManual ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : 'Connect manually'}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={launchEmbeddedSignup}
                      disabled={connectingMeta || !fbReady}
                      className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#1565D8] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition w-full"
                    >
                      {connectingMeta
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                        : !fbReady
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading SDK…</>
                          : <span>{scopeError ? 'Retry auto-connect' : 'Connect via Meta'}</span>}
                    </button>
                  </div>
                )}
              </div>

            </section>
          )}

          {/* Send Test Message */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Send Test Message
            </h3>
            <p className="text-slate-400 text-xs mb-4 ml-9">Verify your WhatsApp connection is working</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                <input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message (optional)</label>
                <input
                  value={testMsg}
                  onChange={e => setTestMsg(e.target.value)}
                  placeholder="Hello from Wapaci! 👋 Your integration is working."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <button
                onClick={sendTestWhatsApp}
                disabled={sendingTest || !testPhone.trim()}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
              >
                {sendingTest ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><MessageCircle className="w-3.5 h-3.5" /> Send Test</>}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Billing ──────────────────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-5">
          {loadingBilling ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
            </div>
          ) : (
            <>
              {/* Current plan */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    Current Plan
                  </h2>
                  <button onClick={loadBilling} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-900 text-lg">{planMeta.label}</p>
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', statusMeta.color)}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm">{planMeta.msgs} · {planMeta.price}</p>
                    {billing?.current_period_end && (
                      <p className="text-slate-400 text-xs mt-0.5">
                        Period ends {new Date(billing.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {billing?.next_billing_date && billing.status === 'active' && (
                      <p className="text-slate-400 text-xs mt-0.5">
                        Next billing: {new Date(billing.next_billing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {billing?.cancelled_at && (
                      <p className="text-red-500 text-xs mt-0.5">
                        Cancelled — access continues until period end
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{planMeta.price}</p>
                    {currentPlan !== 'trial' && <p className="text-xs text-slate-400">per month</p>}
                  </div>
                </div>

                {/* Usage bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-600 font-medium">Messages this month</span>
                    <span className="text-slate-500 font-medium">
                      {billing?.messages_used ?? 0} / {billing?.messages_limit?.toLocaleString('en-IN') ?? 500}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-[#25D366]')}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">Resets on the 1st of each month</p>
                    <p className="text-xs text-slate-500 font-medium">{billing?.messages_remaining ?? 500} remaining</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  {billing?.status !== 'cancelled' && billing?.razorpay_subscription_id && (
                    <button onClick={handleCancel} disabled={cancelling}
                      className="text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl transition hover:bg-red-50 border border-red-200">
                      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Cancel subscription'}
                    </button>
                  )}
                </div>
              </section>

              {/* Plan selection */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">
                  {billing?.status === 'active' ? 'Change Plan' : 'Choose a Plan'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.entries(PLAN_META).filter(([k]) => k !== 'trial') as [PlanKey, typeof PLAN_META[PlanKey]][]).map(([key, plan]) => {
                    const isCurrent = key === currentPlan && currentPlan !== 'trial'
                    const isLoading = subscribing === key
                    return (
                      <div key={key} className={cn(
                        'rounded-2xl border-2 p-5 transition flex flex-col',
                        isCurrent ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200'
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-slate-900">{plan.label}</p>
                          {isCurrent && <span className="text-[10px] bg-[#25D366] text-white px-2 py-0.5 rounded-full font-semibold">Current</span>}
                        </div>
                        <p className="text-2xl font-bold text-slate-900 mb-1">{plan.price}</p>
                        <p className="text-slate-500 text-sm mb-4">{plan.msgs}</p>
                        <div className="space-y-1.5 flex-1">
                          {[
                            plan.msgs,
                            'Abandoned cart recovery',
                            'COD verification',
                            key !== 'starter' ? 'Campaign broadcasts' : null,
                            key === 'pro' ? 'Priority support' : null,
                          ].filter(Boolean).map(f => (
                            <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" /> {f}
                            </div>
                          ))}
                        </div>
                        {!isCurrent && (
                          <button
                            onClick={() => handleSubscribe(key)}
                            disabled={isLoading || !!subscribing}
                            className={cn(
                              'w-full mt-4 text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2',
                              key === 'pro'
                                ? 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                                : 'bg-[#25D366] hover:bg-[#128C7E] text-white disabled:opacity-50'
                            )}
                          >
                            {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</> : (
                              currentPlan !== 'trial' && planMeta.amount > (PLAN_META[key].amount) ? 'Downgrade' : 'Upgrade'
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Payments processed securely via Razorpay. Cancel anytime.
                </p>
              </section>

              {/* Subscription ID (for support) */}
              {billing?.razorpay_subscription_id && (
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400" /> Subscription Details
                  </h3>
                  <div className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-xl break-all">
                    {billing.razorpay_subscription_id}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Share this ID with support for billing queries.</p>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Team Members ─────────────────────────────────────────────────────── */}
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
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="colleague@yourstore.com"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
              </div>
              <div className="w-40 flex-shrink-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleInvite} disabled={sendingInvite || !inviteEmail.trim()}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap">
                  {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {sendingInvite ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              <strong>Role permissions:</strong> Admin (full access) · Manager (automations, campaigns, customers) · Member (read) · Support (conversations only)
            </div>
          </section>

          {/* Members list */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Team Members</h3>
              <button onClick={loadMembers} disabled={loadingMembers}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition">
                <RefreshCw className={cn('w-3.5 h-3.5', loadingMembers && 'animate-spin')} />
              </button>
            </div>

            {/* Always show owner */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-2">
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

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">No team members yet. Invite someone above.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm',
                        m.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {m.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize', ROLE_COLORS[m.role] ?? ROLE_COLORS.member)}>
                            {m.role}
                          </span>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full',
                            m.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                          )}>
                            {m.status === 'pending' ? '• Invite pending' : '• Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id, m.email)}
                      disabled={removingId === m.id}
                      className="text-slate-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50">
                      {removingId === m.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Security ─────────────────────────────────────────────────────────── */}
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
            <p className="text-slate-400 text-xs mb-4 ml-9">Add an extra layer of security</p>
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

// ─── Page wrapper with Suspense ───────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    }>
      <SettingsInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasShopifyConnection, pickPreferredStore } from '@/lib/store-selection'
import {
  Store, MessageCircle, Loader2, Save, CheckCircle2,
  AlertCircle, ExternalLink, Trash2, Info, ChevronDown, ChevronUp,
  CreditCard, Users, Shield,
  UserPlus, Mail, Lock, RefreshCw, XCircle, ArrowUpRight,
  BarChart2, Phone, Target, LayoutDashboard, Pencil, X,
} from 'lucide-react'
import { SIDEBAR_SECTIONS, SIDEBAR_SECTION_KEYS } from '@/lib/sidebar-sections'
import type { UserRole } from '@/lib/user-role'
// Lead-ads billing plans (Razorpay)
const LEAD_PLANS = [
  { id: 'starter',    name: 'Starter',    price: '₹2,499', messages: 5000,      description: 'Best for getting started',        recommended: false },
  { id: 'growth',     name: 'Growth',     price: '₹3,999', messages: 15000,     description: 'For scaling your sales team',     recommended: true  },
  { id: 'scale',      name: 'Scale',      price: '₹7,999', messages: 50000,     description: 'For high-volume businesses',      recommended: false },
  { id: 'enterprise', name: 'Enterprise', price: '₹24,999',messages: 999999999, description: 'Unlimited for large teams',        recommended: false },
] as const
import Link from 'next/link'
import Script from 'next/script'
import { cn, timeAgo } from '@/lib/utils'
import type { Store as StoreType } from '@/types'
import InstallAppCard from '@/components/install-app-card'
import CustomSelect from '@/components/custom-select'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingStatus {
  plan_name: string
  status: string
  billing_provider: string
  messages_limit: number
  messages_used: number
  messages_remaining: number
  current_period_end: string | null
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


const STATUS_META: Record<string, { label: string; color: string }> = {
  trialing:  { label: 'Active',    color: 'bg-green-100 text-green-700' },
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

// 'member' displays as "Sales" everywhere in this UI — matches the label the
// invite-role picker and the Team Activity table both already used.
const ROLE_OPTIONS = [
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Sales' },
  { value: 'support', label: 'Support' },
]

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
  const [savingBusinessType, setSavingBusinessType] = useState(false)
  const [savingSectionKey, setSavingSectionKey] = useState<string | null>(null)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [waNumber, setWaNumber]               = useState('')
  const [waApiKey, setWaApiKey]               = useState('')
  const [storeNameEdit, setStoreNameEdit]     = useState('')
  const [editingName, setEditingName]         = useState(false)
  const [showGuide, setShowGuide]             = useState(false)

  // WhatsApp test message
  const [testPhone, setTestPhone]             = useState('')
  const [testMsg, setTestMsg]                 = useState('')
  const [sendingTest, setSendingTest]         = useState(false)
  const [waConnected, setWaConnected]         = useState(false)
  const [waDisplayPhone, setWaDisplayPhone]   = useState('')
  const [waTokenType, setWaTokenType]         = useState<'user_token' | 'system_user_token' | null>(null)
  const [waConnectionMode, setWaConnectionMode] = useState<'cloud_api' | 'coexistence'>('cloud_api')
  const [showSysUserGuide, setShowSysUserGuide] = useState(false)
  const [fbReady, setFbReady]                 = useState(false)
  const [connectingMeta, setConnectingMeta]   = useState(false)
  // Which onboarding path the merchant picked — drives featureType in the
  // Embedded Signup extras. 'existing' = Coexistence (keep using the WhatsApp
  // Business mobile app); 'new' = normal Cloud-API-only onboarding.
  const [signupMode, setSignupMode]           = useState<'new' | 'existing'>('new')
  // Latest WA_EMBEDDED_SIGNUP window.postMessage event — set by the listener
  // below, read once FB.login()'s own callback fires.
  const lastSignupEventRef = useRef<{ eventType: string; sessionId?: string } | null>(null)
  const [scopeError, setScopeError]           = useState<string | null>(null)
  const [showManual, setShowManual]           = useState(false)
  const [manualWabaId, setManualWabaId]       = useState('')
  const [manualPhoneId, setManualPhoneId]     = useState('')
  const [manualToken, setManualToken]         = useState('')
  const [savingManual, setSavingManual]       = useState(false)
  const [connectDebug, setConnectDebug]       = useState<Record<string, unknown> | null>(null)

  // Account
  const [userEmail, setUserEmail]             = useState('')

  // UI
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab]             = useState<'account' | 'store' | 'sidebar' | 'whatsapp' | 'billing' | 'team' | 'security'>('account')

  // Billing
  const [billing, setBilling]                 = useState<BillingStatus | null>(null)
  const [loadingBilling, setLoadingBilling]   = useState(false)
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null)
  const [billingError, setBillingError]       = useState('')
  const [razorpayReady, setRazorpayReady]     = useState(false)
  // The API now 403s anyone but owner/admin who tries to change the plan —
  // this hides the buttons for those roles instead of letting them click
  // "Upgrade," complete real Razorpay payment, and hit a 403 after the fact.
  const [canManageBilling, setCanManageBilling] = useState(false)
  // Starts as the most restrictive role, not 'owner' — an owner/admin seeing
  // one extra tab flicker in for a moment is harmless; a Sales/Support rep
  // briefly seeing Billing/Team/Profile/Sidebar before this loads is exactly
  // the exposure this is meant to prevent.
  const [role, setRole] = useState<UserRole>('member')
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason]       = useState('')
  const [cancelDetail, setCancelDetail]       = useState('')
  const [cancelling, setCancelling]           = useState(false)
  const [cancelError, setCancelError]         = useState('')
  // Team
  const [members, setMembers]                 = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers]   = useState(false)
  const [inviteEmail, setInviteEmail]         = useState('')
  const [inviteRole, setInviteRole]           = useState('member')
  const [sendingInvite, setSendingInvite]     = useState(false)
  const [removingId, setRemovingId]           = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId]   = useState<string | null>(null)
  const [openRoleMenuId, setOpenRoleMenuId]   = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  // Lead distribution
  const [distMode,    setDistMode]            = useState<'manual'|'open_pool'|'round_robin'>('manual')
  const [distMembers, setDistMembers]         = useState<{user_id:string;email:string;weight:number}[]>([])
  const [activeMembers, setActiveMembers]     = useState<{id:string;user_id:string|null;email:string}[]>([])
  const [savingDist,  setSavingDist]          = useState(false)
  // Team activity — owner/admin only, 403s silently for everyone else (see loadActivity)
  const [teamActivity, setTeamActivity]       = useState<{
    user_id: string; email: string; role: string
    leads_assigned: number; converted: number; calls_logged: number; last_activity_at: string | null
  }[] | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(false)

  const router  = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const urlError   = searchParams.get('error')
  const urlSuccess = searchParams.get('connected')

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }, [])

  // ── Load store + WhatsApp ─────────────────────────────────────────────────────
  // Via a server route (resolves to the org owner) rather than querying
  // stores/whatsapp_accounts directly from the browser client — those tables
  // are keyed by the owner's auth id, and stores' RLS is USING (auth.uid() =
  // user_id), so a teammate querying directly got zero rows back regardless
  // of the org's real setup.
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserEmail(user.email ?? '')

    const res = await fetch('/api/settings/store-status')
    const data = res.ok ? await res.json() as {
      store: StoreType | null
      whatsapp: { status: string; display_phone_number: string | null; token_type: string | null; connection_mode: string | null } | null
    } : { store: null, whatsapp: null }

    const s = data.store
    if (s) {
      setStore(s)
      setStoreNameEdit(s.shop_name ?? '')
      setWaNumber(s.whatsapp_number ?? '')
      setWaApiKey(s.whatsapp_api_key ?? '')
      if (s.shopify_domain) setShopifyDomain('')
    } else {
      setStore(null)
      setStoreNameEdit('')
      setWaNumber('')
      setWaApiKey('')
    }

    const wa = data.whatsapp
    if (wa) {
      setWaConnected(wa.status === 'connected')
      setWaDisplayPhone(wa.display_phone_number ?? '')
      setWaTokenType((wa.token_type as 'user_token' | 'system_user_token') ?? 'user_token')
      setWaConnectionMode((wa.connection_mode as 'cloud_api' | 'coexistence') ?? 'cloud_api')
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Closes the per-row role picker (a compact pill, not a bordered box, so it
  // doesn't use the shared CustomSelect component) when clicking outside it —
  // keyed by member id since there's one of these per row in a .map().
  useEffect(() => {
    if (!openRoleMenuId) return
    const onClickOutside = (e: MouseEvent) => {
      const el = document.querySelector(`[data-role-menu="${openRoleMenuId}"]`)
      if (el && !el.contains(e.target as Node)) setOpenRoleMenuId(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openRoleMenuId])

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

  // ── Embedded Signup session logging ───────────────────────────────────────
  // Meta requires this for Coexistence: the popup posts WA_EMBEDDED_SIGNUP
  // messages independently of the FB.login() callback, and they can arrive
  // out of order. Logging every FINISH/CANCEL/ERROR gives us something to
  // debug against when a merchant reports a failed connection.
  useEffect(() => {
    function handleSignupMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      let parsed: unknown
      try { parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
      const d = parsed as { type?: string; event?: string; data?: { session_id?: string; waba_id?: string } } | null
      if (!d || d.type !== 'WA_EMBEDDED_SIGNUP') return

      const eventType = d.event ?? 'UNKNOWN'
      const sessionId = d.data?.session_id
      lastSignupEventRef.current = { eventType, sessionId }
      console.log('[Wapaci] WA_EMBEDDED_SIGNUP event:', eventType, d)

      fetch('/api/meta/session-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventType, sessionId, data: d }),
      }).catch(() => {})
    }
    window.addEventListener('message', handleSignupMessage)
    return () => window.removeEventListener('message', handleSignupMessage)
  }, [])

  const urlTab = searchParams.get('tab')

  useEffect(() => {
    if (urlTab === 'whatsapp') setActiveTab('whatsapp')
    else if (urlTab === 'team') setActiveTab('team')
    else if (urlTab === 'store') setActiveTab('store')
    else if (urlTab === 'sidebar') setActiveTab('sidebar')
    else if (urlTab === 'billing') setActiveTab('billing')
    else if (urlTab === 'security') setActiveTab('security')
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
    if (urlError) showToast(SHOPIFY_ERROR_MESSAGES[urlError] ?? 'Could not connect your Shopify store. Please try again.', false)
    if (err) showToast(decodeURIComponent(err), false)
  }, [urlError, urlSuccess, showToast, searchParams, loadData])

  // ── Load billing ──────────────────────────────────────────────────────────────
  const loadBilling = useCallback(async () => {
    setLoadingBilling(true)
    const res = await fetch('/api/billing/status')
    if (res.ok) setBilling(await res.json())
    setLoadingBilling(false)
  }, [])

  // Real checkout — previously "Upgrade"/"Downgrade" were just a wa.me link
  // asking the user to message in and get changed manually.
  async function handleSubscribe(planId: string) {
    setBillingError('')
    setSubscribingPlan(planId)
    try {
      const res = await fetch('/api/billing/razorpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json().catch(() => ({})) as {
        subscriptionId?: string; keyId?: string; prefill?: { name: string; email: string }; error?: string
      }
      if (!res.ok || !data.subscriptionId || !data.keyId) {
        setBillingError(data.error ?? 'Could not start checkout — please try again.')
        setSubscribingPlan(null)
        return
      }
      if (!razorpayReady || !window.Razorpay) {
        setBillingError('Payment widget is still loading — try again in a moment.')
        setSubscribingPlan(null)
        return
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'Wapaci',
        description: `${LEAD_PLANS.find(p => p.id === planId)?.name ?? planId} plan`,
        prefill: data.prefill,
        theme: { color: '#25D366' },
        handler: () => { loadBilling(); setSubscribingPlan(null) },
        modal: { ondismiss: () => setSubscribingPlan(null) },
      })
      rzp.open()
    } catch {
      setBillingError('Could not start checkout — check your connection and try again.')
      setSubscribingPlan(null)
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setCancelError("Please tell us why you're cancelling.")
      return
    }
    setCancelError('')
    setCancelling(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason, detail: cancelDetail }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setCancelError(data.error ?? 'Could not cancel — please try again.')
        return
      }
      setShowCancelModal(false)
      setCancelReason('')
      setCancelDetail('')
      loadBilling()
    } catch {
      setCancelError('Could not cancel — check your connection and try again.')
    } finally {
      setCancelling(false)
    }
  }

  // Runs on mount, not gated by activeTab — the TABS filter below needs the
  // real role before the first render decides which tabs to show at all,
  // not just once someone happens to click into Billing.
  useEffect(() => {
    fetch('/api/me/role')
      .then(r => r.json())
      .then((d: { role?: string }) => {
        const r = (d.role as UserRole) ?? 'member'
        setRole(r)
        setCanManageBilling(r === 'owner' || r === 'admin')
      })
      .catch(() => {})
      .finally(() => setRoleLoaded(true))
  }, [])

  useEffect(() => {
    if (activeTab !== 'billing') return
    loadBilling()
  }, [activeTab, loadBilling])

  // Also fetch once on mount, independent of which tab is active — the
  // Account tab's "{planLabel} plan" line (rendered immediately, before
  // anyone has necessarily ever clicked into Billing this session) reads
  // `billing`, which used to stay null until the Billing tab's own effect
  // above ran. A paid account landing on the default Account tab would see
  // "Trial plan" — the fallback for a null `billing` — until they happened
  // to click into Billing at least once.
  useEffect(() => { loadBilling() }, [loadBilling])

  // Filtering the tab BUTTONS isn't enough on its own — a deep link like
  // ?tab=billing sets activeTab before role is even known (see the urlTab
  // effect above), and each tab's content section is gated purely on
  // activeTab, not on role. Without this, a Sales rep opening that link
  // directly would still see the Billing panel render underneath, just
  // with no button for it in the bar. Gated on roleLoaded specifically (not
  // just "role !== owner/admin") — role starts at the restrictive default
  // before the fetch resolves, and redirecting on that default would bounce
  // a legitimate owner/admin's own ?tab=billing deep link back to Account
  // before their real role even loads.
  const OWNER_ONLY_TABS = ['store', 'sidebar', 'whatsapp', 'billing', 'team']
  useEffect(() => {
    if (!roleLoaded || role === 'owner' || role === 'admin') return
    if (OWNER_ONLY_TABS.includes(activeTab)) setActiveTab('account')
  }, [roleLoaded, role, activeTab])

  // Keep the active tab pill visible in the scrollable tab bar — matters when landing
  // directly on a non-first tab (e.g. ?tab=team), where it'd otherwise start scrolled
  // out of view with nothing visibly selected. Depends on `loading` too: the tab bar
  // doesn't exist in the DOM until the loading skeleton (an early `if (loading) return`
  // above) is replaced by the real content, which can happen after activeTab has
  // already settled — without `loading` here this would silently never find the button.
  useEffect(() => {
    document.querySelector(`[data-settings-tab="${activeTab}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeTab, loading])

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
    if (activeTab === 'team') {
      loadMembers()
      setLoadingActivity(true)
      fetch('/api/settings/team-activity')
        .then(r => (r.ok ? r.json() : Promise.reject()) as Promise<{ activity: typeof teamActivity }>)
        .then(d => setTeamActivity(d.activity ?? []))
        .catch(() => setTeamActivity(null)) // 403 for non-admins, or any failure — section just stays hidden
        .finally(() => setLoadingActivity(false))
      fetch('/api/settings/lead-distribution')
        .then(r => r.json() as Promise<{mode?:string;distribution_members?:{user_id:string;weight:number}[];active_members?:{id:string;user_id:string|null;email:string}[]}>)
        .then(d => {
          setDistMode((d.mode ?? 'manual') as 'manual'|'open_pool'|'round_robin')
          setActiveMembers(d.active_members ?? [])
          // Merge stored order with current active members
          const stored = d.distribution_members ?? []
          const active = d.active_members ?? []
          const merged = active.map(m => {
            const s = stored.find((x: {user_id:string;weight:number}) => x.user_id === m.user_id)
            return { user_id: m.user_id!, email: m.email, weight: s?.weight ?? 1 }
          }).filter(m => m.user_id)
          setDistMembers(merged)
        })
        .catch(() => {})
    }
  }, [activeTab, loadMembers])

  // ── Store actions ─────────────────────────────────────────────────────────────
  function handleConnectShopify() {
    if (!shopifyDomain.trim()) return
    let domain = shopifyDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`
    setConnecting(true)
    const url = `/dashboard/shopify/connect?shop=${encodeURIComponent(domain)}&returnTo=/dashboard/settings?tab=store&popup=1`
    const popup = window.open(url, 'wapaci-shopify-connect', 'width=960,height=760')
    if (!popup) window.location.href = url
  }

  async function saveWhatsApp() {
    if (!store) return
    setSavingWA(true)
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: waNumber || null, whatsapp_api_key: waApiKey || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save your WhatsApp settings — please try again.", false)
        return
      }
      showToast('WhatsApp settings saved!')
    } catch {
      showToast("Couldn't save your WhatsApp settings — check your connection and try again.", false)
    } finally {
      setSavingWA(false)
    }
  }

  async function saveStoreName() {
    if (!store || !storeNameEdit.trim()) return
    setSavingStore(true)
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_name: storeNameEdit.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save your store name — please try again.", false)
        return
      }
      setStore(prev => prev ? { ...prev, shop_name: storeNameEdit.trim() } : prev)
      setEditingName(false)
      showToast('Store name saved!')
      router.refresh()  // re-renders server components (sidebar footer shows this name) so it updates immediately
    } catch {
      showToast("Couldn't save your store name — check your connection and try again.", false)
    } finally {
      setSavingStore(false)
    }
  }

  async function setBusinessType(type: 'ecommerce' | 'lead_gen') {
    if (!store || store.business_type === type) return
    setSavingBusinessType(true)
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: type }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save your dashboard view — please try again.", false)
        return
      }
      setStore(prev => prev ? { ...prev, business_type: type } : prev)
      showToast('Business type saved!')
      router.refresh()  // re-renders server components (dashboard reads business_type) so it updates immediately
    } catch {
      showToast("Couldn't save your dashboard view — check your connection and try again.", false)
    } finally {
      setSavingBusinessType(false)
    }
  }

  async function toggleSection(key: string) {
    if (!store) return
    // NULL/empty visible_sections means "show everything" (see
    // lib/sidebar-sections.ts) — unchecking the first item ever needs to
    // start from the full list, not an empty one, or it'd read as "only
    // show this one item" instead of "show everything except this one."
    const current = store.visible_sections && store.visible_sections.length > 0
      ? store.visible_sections : SIDEBAR_SECTION_KEYS
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    // An empty array is the exact same value lib/sidebar-sections.ts's
    // resolveVisibleSections() treats as "nothing customized yet — show
    // everything" (it has to, for every pre-existing account that never set
    // this column). Saving [] here to mean "hide every section" would
    // silently flip to the opposite the instant it round-trips through that
    // function — the sidebar/mobile nav would come back showing all of
    // them, with nothing telling the user their last uncheck didn't stick.
    if (next.length === 0) {
      showToast('At least one section must stay visible', false)
      return
    }
    setSavingSectionKey(key)
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible_sections: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save your sidebar sections — please try again.", false)
        return
      }
      setStore(prev => prev ? { ...prev, visible_sections: next } : prev)
      router.refresh()  // re-renders server components (sidebar/mobile nav read this) so it updates immediately
    } catch {
      showToast("Couldn't save your sidebar sections — check your connection and try again.", false)
    } finally {
      setSavingSectionKey(null)
    }
  }

  async function disconnectStore() {
    const connectedStore = store
    if (!connectedStore?.shopify_domain) return
    if (!confirm(`Disconnect ${connectedStore.shop_name ?? connectedStore.shopify_domain ?? 'this store'}? Automations will stop, but your Wapaci store and WhatsApp settings are kept.`)) return

    try {
      const res = await fetch('/api/shopify/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        showToast(data.error ?? "Couldn't disconnect Shopify — please try again.", false)
        return
      }
      setShopifyDomain('')
      await loadData()
      router.refresh()  // re-renders server components so sidebar updates immediately
      showToast('Shopify store disconnected')
    } catch {
      showToast("Couldn't disconnect Shopify — check your connection and try again.", false)
    }
  }

  async function syncProducts() {
    if (!store?.shopify_domain) return
    setSyncingProducts(true)
    try {
      const res  = await fetch('/api/shopify/sync-products', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { count?: number; error?: string }
      if (res.ok && data.count !== undefined) {
        showToast(`${data.count} product${data.count !== 1 ? 's' : ''} found in your store`)
        setStore(prev => prev ? { ...prev, product_count: data.count! } : prev)
      } else {
        showToast(data.error ?? "Couldn't sync products from Shopify — please try again.", false)
      }
    } catch {
      showToast("Couldn't sync products from Shopify — check your connection and try again.", false)
    } finally {
      setSyncingProducts(false)
    }
  }

// ── WhatsApp test message ─────────────────────────────────────────────────────
  async function sendTestWhatsApp() {
    if (!testPhone.trim()) return
    setSendingTest(true)
    try {
      const res  = await fetch('/api/whatsapp/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: testPhone.trim() }),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; messageId?: string; error?: string; phone?: string }
      if (data.success) {
        showToast(`✓ Message sent to ${data.phone ?? testPhone.trim()}${data.messageId ? ` (ID: ${data.messageId.slice(0, 16)}…)` : ''}`)
      } else {
        showToast(data.error ?? "Couldn't send the test message — check your WhatsApp connection and try again.", false)
      }
    } catch {
      showToast("Couldn't send the test message — check your connection and try again.", false)
    } finally {
      setSendingTest(false)
    }
  }

  // ── Meta Embedded Signup — launch FB.login() popup ───────────────────────────
  function launchEmbeddedSignup() {
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID
    const appId    = process.env.NEXT_PUBLIC_META_APP_ID

    if (!appId) { showToast('WhatsApp connection via Meta is not set up yet for this account. Please contact support.', false); return }

    const w  = window as unknown as { FB?: { login: (cb: (r: { authResponse?: { code?: string } | null; status?: string }) => void, opts: object) => void } }
    const FB = w.FB

    if (!FB) { showToast("Facebook's connection SDK hasn't loaded yet — refresh the page and try again.", false); return }

    if (!configId) {
      showToast('WhatsApp connection via Meta is not fully set up for this account. Please contact support.', false)
      return
    }

    // Session logging is independent of the FB.login() callback below — Meta's
    // own docs warn the code and the postMessage session event can arrive
    // separately. lastSignupEventRef is populated by the window listener and
    // read once the callback fires, to confirm which onboarding path Meta
    // actually routed this signup through.
    lastSignupEventRef.current = null

    // featureType is what actually triggers Coexistence (Meta docs:
    // "Leave blank to enable the default onboarding flow" — set it only when
    // the merchant told us they already use this number in WhatsApp Business).
    const extras: { sessionInfoVersion: number; featureType?: string } = { sessionInfoVersion: 2 }
    if (signupMode === 'existing') extras.featureType = 'whatsapp_business_app_onboarding'

    // ── Debug: print full SDK config before launching ──────────────────────────
    const fbLoginOpts = {
      config_id:                      configId,
      response_type:                  'code',
      override_default_response_type: true,
      extras,
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

      // Cast to any so we can probe all possible locations Meta may put sessionInfo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any

      const code = raw?.authResponse?.code as string | undefined

      // Meta has placed sessionInfo in different locations across SDK versions:
      // check every known location and take the first that has wabaID
      const candidateInfo =
        raw?.authResponse?.sessionInfo ??
        raw?.authResponse?.session_info ??
        raw?.sessionInfo ??
        raw?.session_info ??
        null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function hasWabaFields(x: any): boolean {
        return !!(x?.wabaID || x?.waba_id || x?.phoneNumberID || x?.phone_number_id)
      }

      // Normalise field names (Meta uses camelCase in docs, but real responses vary)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function normaliseSessionInfo(x: any) {
        if (!x) return null
        return {
          businessID:         x.businessID         ?? x.business_id         ?? undefined,
          businessName:       x.businessName        ?? x.business_name       ?? undefined,
          wabaID:             x.wabaID              ?? x.waba_id             ?? undefined,
          wabaName:           x.wabaName            ?? x.waba_name           ?? undefined,
          phoneNumberID:      x.phoneNumberID       ?? x.phone_number_id     ?? undefined,
          displayPhoneNumber: x.displayPhoneNumber  ?? x.display_phone_number ?? undefined,
        }
      }

      const sessionInfo = hasWabaFields(candidateInfo) ? normaliseSessionInfo(candidateInfo) : null

      // Log the full raw authResponse so we can debug what Meta actually returned
      console.log('[Wapaci] FB.login() authResponse keys:', Object.keys(raw?.authResponse ?? {}))
      console.log('[Wapaci] sessionInfo candidate:', JSON.stringify(candidateInfo, null, 2))
      console.log('[Wapaci] normalised sessionInfo:', JSON.stringify(sessionInfo, null, 2))

      // No code = user cancelled, closed popup, or Meta returned an error
      if (!code) {
        setConnectingMeta(false)
        const status = response.status ?? ''
        // 'unknown' = user closed without completing; don't show an error for that
        if (status !== 'unknown' && status !== '') {
          showToast('Facebook sign-in was cancelled before WhatsApp could connect. Please try again.', false)
        }
        return
      }

      // Prefer what Meta's own postMessage event confirmed over what we merely
      // requested — if featureType was set but Meta routed it to the default
      // flow anyway (e.g. the number wasn't eligible), we shouldn't record it
      // as coexistence. Fall back to intent only if no event arrived in time.
      const signupEvent = lastSignupEventRef.current?.eventType
      const connectionMode: 'cloud_api' | 'coexistence' =
        signupEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ? 'coexistence' :
        signupEvent === 'FINISH'                                  ? 'cloud_api'   :
        signupMode === 'existing'                                 ? 'coexistence' : 'cloud_api'

      console.log('[Wapaci] received code, sessionInfo present:', !!sessionInfo, 'connectionMode:', connectionMode, '— posting to /api/meta/callback')
      fetch('/api/meta/callback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          code,
          sessionInfo,
          connectionMode,
          // send the full raw authResponse so the server can log it for debugging
          rawAuthResponseKeys: Object.keys(raw?.authResponse ?? {}),
          rawAuthResponse:     raw?.authResponse,
        }),
      })
        .then(r => r.json())
        .then((data: { ok: boolean; phone?: string; error?: string; debug?: Record<string, unknown>; rawAuthResponseKeys?: string[]; rawAuthResponse?: Record<string, unknown> }) => {
          console.group('[Wapaci] Meta callback result')
          console.log('ok:', data.ok)
          console.log('error:', data.error ?? '(none)')
          console.log('rawAuthResponseKeys:', data.rawAuthResponseKeys)
          console.log('rawAuthResponse:', data.rawAuthResponse)
          console.log('debug:', data.debug)
          console.groupEnd()

          if (data.ok) {
            setScopeError(null)
            setConnectDebug(null)
            showToast(`WhatsApp connected! ${data.phone ? `Number: ${data.phone}` : ''}`)
            loadData()
          } else {
            // Your account has not been changed by this failure — Meta's own popup
            // may show a "disconnect from the existing account" screen for a number
            // that isn't eligible for Coexistence yet, but we never forward that as
            // an instruction to the merchant. Never tell them to delete/disconnect
            // their existing WhatsApp account to "fix" this.
            const errMsg = signupMode === 'existing'
              ? `We couldn't connect this number using WhatsApp Business App Coexistence. Your WhatsApp account has not been changed. ${data.error ? `(${data.error})` : ''} Please retry, or connect as a new number instead.`
              : (data.error ?? 'Could not connect WhatsApp')
            setScopeError(errMsg)
            setConnectDebug({
              rawAuthResponseKeys: data.rawAuthResponseKeys ?? [],
              rawAuthResponse:     data.rawAuthResponse ?? {},
              granted_scopes:      data.debug?.granted_scopes ?? [],
              businesses_returned: data.debug?.businesses_returned ?? 0,
              sessionInfo_sent:    !!(sessionInfo),
            })
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
    try {
      const res  = await fetch('/api/meta/manual-connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wabaId: manualWabaId.trim(), phoneNumberId: manualPhoneId.trim(), accessToken: manualToken.trim() }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; phone?: string; error?: string }
      if (data.ok) {
        setScopeError(null)
        setShowManual(false)
        showToast(`WhatsApp connected! Number: ${data.phone ?? ''}`)
        loadData()
      } else {
        showToast(data.error ?? "Couldn't connect manually — double-check the WABA ID, Phone Number ID, and access token.", false)
      }
    } catch {
      showToast("Couldn't connect manually — check your connection and try again.", false)
    } finally {
      setSavingManual(false)
    }
  }

  // ── Disconnect Meta WhatsApp ───────────────────────────────────────────────────
  async function disconnectMeta() {
    if (!confirm('Disconnect WhatsApp? Your automations will stop sending real messages.')) return
    try {
      const res = await fetch('/api/meta/disconnect', { method: 'POST' })
      if (res.ok) {
        setWaConnected(false)
        setWaDisplayPhone('')
        setWaTokenType(null)
        setShowSysUserGuide(false)
        showToast('WhatsApp disconnected')
        await loadData()
      } else {
        showToast("Couldn't disconnect WhatsApp — please try again.", false)
      }
    } catch {
      showToast("Couldn't disconnect WhatsApp — check your connection and try again.", false)
    }
  }

  // ── Team actions ──────────────────────────────────────────────────────────────
  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    // Same check the backend enforces — catches it before a network round
    // trip instead of only after the bogus row is already in the DB.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Invalid email address', false); return }
    setSendingInvite(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; alreadyActive?: boolean; message?: string; warning?: string; invite?: { email: string } }
      if (!res.ok) { showToast(data.error ?? "Couldn't send the invite — please try again.", false); return }
      setInviteEmail('')
      if (data.alreadyActive) {
        // Re-inviting someone who already has a confirmed account (e.g. after
        // removing and re-adding them) — no email needed, they're already in.
        showToast(data.message ?? 'Team member added back.')
      } else if (data.warning) {
        showToast(data.warning, false)
      } else {
        showToast(`Invite email sent to ${data.invite?.email}`)
      }
      await loadMembers()
    } catch {
      showToast("Couldn't send the invite — check your connection and try again.", false)
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleRemoveMember(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team?`)) return
    setRemovingId(id)
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { showToast(data.error ?? "Couldn't remove this team member — please try again.", false); return }
      showToast('Member removed')
      setMembers(prev => prev.filter(m => m.id !== id))
    } catch {
      showToast("Couldn't remove this team member — check your connection and try again.", false)
    } finally {
      setRemovingId(null)
    }
  }

  async function handleChangeRole(id: string, role: string) {
    const prev = members.find(m => m.id === id)?.role
    setChangingRoleId(id)
    setMembers(list => list.map(m => m.id === id ? { ...m, role } : m)) // optimistic
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't update this member's role — please try again.", false)
        if (prev) setMembers(list => list.map(m => m.id === id ? { ...m, role: prev } : m)) // revert
        return
      }
      showToast('Role updated')
    } catch {
      showToast("Couldn't update this member's role — check your connection and try again.", false)
      if (prev) setMembers(list => list.map(m => m.id === id ? { ...m, role: prev } : m)) // revert
    } finally {
      setChangingRoleId(null)
    }
  }

  // Changes the password directly for an already-authenticated user — no
  // email round-trip at all. The previous design sent a password-reset
  // email even though the person was already logged in, which routed
  // through Supabase's PKCE email-link flow — that flow stores a secret in
  // whichever browser/device requests it, so it silently fails if the link
  // is opened anywhere else (a different browser, a different device,
  // even a different profile). None of that applies here: re-verifying the
  // current password via signInWithPassword, then calling updateUser(),
  // works instantly and entirely within the current session.
  async function handleChangePassword() {
    if (changingPassword) return
    if (newPassword.length < 6) { showToast('New password must be at least 6 characters', false); return }
    if (newPassword !== confirmNewPassword) { showToast("New passwords don't match", false); return }

    setChangingPassword(true)
    try {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword })
      if (verifyErr) {
        showToast('Current password is incorrect', false)
        return
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) {
        // Supabase auth messages here are already written for end users (e.g.
        // "New password should be different from the old password.") — pass
        // them through, but fall back to something clear if it's ever an
        // unrecognized/technical string instead.
        const readable = /password/i.test(updateErr.message)
        showToast(readable ? updateErr.message : "Couldn't change your password — please try again.", false)
        return
      }

      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('')
      showToast('Password changed')
    } catch {
      showToast("Couldn't change your password — check your connection and try again.", false)
    } finally {
      setChangingPassword(false)
    }
  }

  async function saveDist() {
    setSavingDist(true)
    try {
      const res = await fetch('/api/settings/lead-distribution', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: distMode,
          distribution_members: distMembers.map(({ user_id, weight }) => ({ user_id, weight })),
        }),
      })
      if (res.ok) {
        showToast('Distribution settings saved!')
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save your lead distribution settings — please try again.", false)
      }
    } catch {
      showToast("Couldn't save your lead distribution settings — check your connection and try again.", false)
    } finally {
      setSavingDist(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  const currentLeadPlan = LEAD_PLANS.find(p => p.id === billing?.plan_name)
  const planLabel    = currentLeadPlan?.name ?? (billing?.plan_name === 'trial' || !billing ? 'Trial' : billing.plan_name)
  const planPrice    = currentLeadPlan ? `${currentLeadPlan.price}/mo` : null
  const statusMeta   = STATUS_META[billing?.status ?? 'trialing'] ?? STATUS_META.trialing
  const usagePct     = billing ? Math.min(100, Math.round((billing.messages_used / billing.messages_limit) * 100)) : 0

  // Profile/Sidebar/WhatsApp/Billing/Team are all owner/admin actions
  // server-side (every mutation they trigger 403s for anyone else) — showing
  // them to a Sales/Support/Manager rep anyway meant a tab full of controls
  // that would just fail, plus exposing things like the org's billing status
  // and team roster to a role with no reason to see either. Account (their
  // own email) and Security (their own password) stay visible to everyone.
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const TABS = [
    { id: 'account',  label: 'Account',   icon: Store,           ownerOnly: false },
    { id: 'store',    label: 'Profile',    icon: Store,           ownerOnly: true  },
    { id: 'sidebar',  label: 'Sidebar',    icon: LayoutDashboard, ownerOnly: true  },
    { id: 'whatsapp', label: 'WhatsApp',   icon: MessageCircle,   ownerOnly: true  },
    { id: 'billing',  label: 'Billing',     icon: CreditCard,     ownerOnly: true  },
    { id: 'team',     label: 'Team',       icon: Users,           ownerOnly: true  },
    { id: 'security', label: 'Security',   icon: Shield,          ownerOnly: false },
  ] as const
  const visibleTabs = TABS.filter(t => !t.ownerOnly || isOwnerOrAdmin)

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-fade-in max-w-3xl">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onLoad={() => setRazorpayReady(true)} />

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 left-4 right-4 sm:left-auto sm:top-5 sm:right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium sm:max-w-sm',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="mb-5 md:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">Manage your account, store, usage, and team</p>
      </div>

      {/* Tab navigation — 6 tabs don't fit a phone width, so this scrolls. Unlike
          an underlined tab row, a solid pill control gives no visual hint it's
          cut off — it just looks like a complete, self-contained row — which is
          how Team ended up invisible on mobile with nothing suggesting it was
          one swipe away. The fade at least signals there's more. */}
      <div className="relative mb-5 md:mb-7">
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 overflow-x-auto -mx-1 px-1 sm:mx-0">
          {visibleTabs.map(({ id, label }) => (
            <button
              key={id}
              data-settings-tab={id}
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
        <div className="md:hidden pointer-events-none absolute top-1 right-1 bottom-1 w-8 rounded-r-2xl bg-gradient-to-l from-slate-100 to-transparent" />
      </div>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-5', activeTab !== 'account' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-slate-500" />
          </div>
          Account
        </h2>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
          <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {userEmail[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">{userEmail}</p>
            <p className="text-slate-400 text-xs">Account email · {planLabel} plan</p>
          </div>
        </div>

        <InstallAppCard />
      </section>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-5', activeTab !== 'store' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-green-600" />
          </div>
          Profile
        </h2>

        {store ? (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={storeNameEdit}
                    onChange={e => setStoreNameEdit(e.target.value)}
                    placeholder="My Business"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveStoreName()
                      if (e.key === 'Escape') { setStoreNameEdit(store.shop_name ?? ''); setEditingName(false) }
                    }}
                    className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-green-300 rounded-lg text-base font-semibold text-green-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <button onClick={saveStoreName} disabled={savingStore || !storeNameEdit.trim()}
                    title="Save"
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition">
                    {savingStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setStoreNameEdit(store.shop_name ?? ''); setEditingName(false) }} disabled={savingStore}
                    title="Cancel"
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-lg transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <p className="font-semibold text-green-800 truncate">{store.shop_name ?? 'My Workspace'}</p>
                  <button onClick={() => { setStoreNameEdit(store.shop_name ?? ''); setEditingName(true) }}
                    title="Edit workspace name"
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-green-600/70 hover:text-green-700 hover:bg-green-100 transition opacity-70 group-hover:opacity-100">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-green-500 text-xs mt-0.5">
                Active since {store.connected_at
                  ? new Date(store.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'today'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-600">Setting up your workspace…</p>
            <p className="text-slate-400 text-sm mt-1">Refresh the page to continue.</p>
          </div>
        )}
      </section>

      {/* ── Sidebar customization ────────────────────────────────────────────── */}
      <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-5', activeTab !== 'sidebar' && 'hidden')}>
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
          </div>
          Sidebar &amp; Dashboard
        </h2>
        <p className="text-slate-400 text-xs mb-5 ml-9">Choose what shows in your sidebar and mobile nav — nothing here is ever locked, pick anything regardless of business type.</p>

        {store ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dashboard view</label>
              <p className="text-xs text-slate-400 mb-2">Controls which metrics your Dashboard home page shows by default.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'ecommerce' as const, label: 'Ecommerce Store' },
                  { key: 'lead_gen' as const,  label: 'Lead Generation' },
                ]).map(({ key, label }) => {
                  const on = (store.business_type ?? 'lead_gen') === key
                  return (
                    <button
                      key={key}
                      onClick={() => setBusinessType(key)}
                      disabled={savingBusinessType}
                      className={cn(
                        'flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2.5 rounded-xl border-2 transition disabled:opacity-50',
                        on ? 'border-[#25D366] bg-[#25D366]/5 text-[#128C7E]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      )}
                    >
                      {/* Icon always takes up space, just hidden when unselected —
                          conditionally rendering it (instead of hiding it) shifted
                          how much width was left for the label, so the selected
                          button could wrap to a second line while the other stayed
                          on one, making the two buttons different heights. */}
                      <CheckCircle2 className={cn('w-3.5 h-3.5 flex-shrink-0', !on && 'invisible')} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sidebar sections</label>
              <p className="text-xs text-slate-400 mb-2">Everything checked appears in your sidebar (and as mobile nav tabs) — check as many as you use.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SIDEBAR_SECTIONS.map(({ key, label }) => {
                  const on = !store.visible_sections || store.visible_sections.length === 0 || store.visible_sections.includes(key)
                  const saving = savingSectionKey === key
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSection(key)}
                      // Disabled while ANY toggle in this grid is saving, not just
                      // this one — two rapid clicks before the first PATCH resolves
                      // would otherwise both read the same stale store.visible_sections
                      // and the second write silently clobbers the first.
                      disabled={savingSectionKey !== null}
                      className={cn(
                        'flex items-center gap-2 text-sm font-medium px-3 py-2.5 rounded-xl border-2 transition disabled:opacity-50 text-left',
                        on ? 'border-[#25D366] bg-[#25D366]/5 text-[#128C7E]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      )}
                    >
                      {saving
                        ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
                        : <div className={cn('w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center', on ? 'border-[#25D366] bg-[#25D366]' : 'border-slate-300')}>
                            {on && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>}
                      <span className="truncate">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-600">Setting up your workspace…</p>
            <p className="text-slate-400 text-sm mt-1">Refresh the page to continue.</p>
          </div>
        )}
      </section>

      {/* ── WhatsApp ─────────────────────────────────────────────────────────── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-5">
          {/* Meta connection status */}
          {waConnected ? (
            <section className="bg-white rounded-2xl shadow-sm border border-[#25D366]/30 p-4 sm:p-6">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                </div>
                WhatsApp Connected
              </h2>

              {/* Connected number row */}
              <div className="flex items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-green-800">
                      {waConnectionMode === 'coexistence' ? 'WhatsApp Business App + Wapaci' : 'Meta WhatsApp Cloud API'}
                    </p>
                    <p className="text-green-600 text-sm">{waDisplayPhone || 'Number connected'}</p>
                    {waConnectionMode === 'coexistence' && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Still active on your phone
                      </span>
                    )}
                    {waTokenType === 'system_user_token' && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Permanent system token
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full flex-shrink-0">
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
                            <div key={step} className="flex gap-3 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                {step}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{title}</p>
                                <p className="text-slate-500 mt-0.5">{desc}</p>
                                {vars?.map(v => (
                                  <code key={v} className="block mt-1 text-[10px] bg-slate-100 px-2 py-1 rounded font-mono break-all">{v}</code>
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
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
              <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                </div>
                Connect WhatsApp Number
              </h2>
              <p className="text-slate-400 text-xs mb-5 ml-9">Choose how to connect your WhatsApp Business number</p>

              {/* Option 1: Meta Cloud API */}
              <div className="bg-gradient-to-br from-blue-50 to-[#25D366]/5 border border-blue-200 rounded-2xl p-4 sm:p-5 mb-4">
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
                          <button onClick={() => { setScopeError(null); setShowManual(false); setConnectDebug(null) }} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">Dismiss</button>
                        </div>
                        <p className="text-red-700 text-xs leading-relaxed">{scopeError}</p>

                        {connectDebug && (
                          <details className="text-[10px] text-slate-500">
                            <summary className="cursor-pointer text-slate-400 hover:text-slate-600 select-none">Show debug info (share this screenshot if asked)</summary>
                            <pre className="mt-2 bg-white border border-slate-200 rounded-lg p-2 overflow-x-auto text-[9px] leading-relaxed whitespace-pre-wrap break-all">
                              {JSON.stringify(connectDebug, null, 2)}
                            </pre>
                          </details>
                        )}

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
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number ID</label>
                          <input value={manualPhoneId} onChange={e => setManualPhoneId(e.target.value)}
                            placeholder="e.g. 987654321098765"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Permanent Access Token <span className="text-slate-400">(from Meta System User)</span></label>
                          <input value={manualToken} onChange={e => setManualToken(e.target.value)}
                            type="password"
                            placeholder="EAAxxxxxxx…"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
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

                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-slate-600">Which describes you?</p>
                      <label className={cn(
                        'flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition',
                        signupMode === 'existing' ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                      )}>
                        <input
                          type="radio" name="signupMode" className="mt-0.5"
                          checked={signupMode === 'existing'}
                          onChange={() => setSignupMode('existing')}
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">I already use this number on WhatsApp Business</span>
                          <span className="block text-xs text-slate-500 mt-0.5">Keep using the WhatsApp Business app on your phone while connecting it to Wapaci.</span>
                        </span>
                      </label>
                      <label className={cn(
                        'flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition',
                        signupMode === 'new' ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                      )}>
                        <input
                          type="radio" name="signupMode" className="mt-0.5"
                          checked={signupMode === 'new'}
                          onChange={() => setSignupMode('new')}
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">I want to connect a new number</span>
                          <span className="block text-xs text-slate-500 mt-0.5">Set up a number that isn't currently active in WhatsApp Business.</span>
                        </span>
                      </label>
                    </div>

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
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message (optional)</label>
                <input
                  value={testMsg}
                  onChange={e => setTestMsg(e.target.value)}
                  placeholder="Hello from Wapaci! 👋 Your integration is working."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
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
              {/* Current plan + usage */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5 text-[#25D366]" />
                    </div>
                    Current Plan
                  </h2>
                  <button onClick={loadBilling} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-900 text-lg">{planLabel}</p>
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', statusMeta.color)}>
                        {statusMeta.label}
                      </span>
                    </div>
                    {planPrice && <p className="text-slate-500 text-sm">{planPrice}</p>}
                    {currentLeadPlan && <p className="text-slate-400 text-xs mt-0.5">{currentLeadPlan.messages >= 999999999 ? 'Unlimited messages' : `${currentLeadPlan.messages.toLocaleString()} messages/mo`}</p>}
                  </div>
                </div>

                {/* Usage bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-600 font-medium">Messages this month</span>
                    <span className="text-slate-500 font-medium">
                      {(billing?.messages_used ?? 0).toLocaleString()} / {(billing?.messages_limit ?? 500) >= 999_999_999 ? 'Unlimited' : (billing?.messages_limit ?? 500).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-[#25D366]')}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-1">
                    <p className="text-xs text-slate-400">Resets on the 1st of each month</p>
                    <p className="text-xs text-slate-500 font-medium">{(billing?.messages_remaining ?? 500).toLocaleString()} remaining</p>
                  </div>
                </div>
              </section>

              {/* All plans comparison */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                <h3 className="font-semibold text-slate-800 mb-1">All Plans</h3>
                <p className="text-slate-400 text-xs mb-5">
                  Billed monthly via Razorpay. Cancel anytime.
                  {billing?.status === 'active' && canManageBilling && (
                    <>
                      {' '}
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="text-slate-400 hover:text-red-500 underline transition"
                      >
                        Cancel subscription
                      </button>
                    </>
                  )}
                </p>
                {billingError && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600">{billingError}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {LEAD_PLANS.map(plan => {
                    const isCurrent     = billing?.plan_name === plan.id && billing?.status === 'active'
                    const isPending     = billing?.plan_name === plan.id && (billing?.status === 'pending' || billing?.status === 'trialing')
                    const isRecommended = plan.recommended
                    const isUnlimited   = plan.messages >= 999999999
                    const currentIdx    = LEAD_PLANS.findIndex(p => p.id === billing?.plan_name)
                    const planIdx       = LEAD_PLANS.findIndex(p => p.id === plan.id)
                    const isDowngrade   = currentIdx > -1 && planIdx < currentIdx
                    return (
                      <div key={plan.id}
                        className={cn(
                          'relative rounded-xl border p-4 flex flex-col gap-3',
                          isCurrent     ? 'border-[#25D366] bg-[#25D366]/5'
                          : isRecommended ? 'border-blue-200 bg-blue-50/50'
                          : 'border-slate-100 bg-slate-50/50'
                        )}
                      >
                        {isRecommended && !isCurrent && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-blue-500 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Most popular
                          </span>
                        )}
                        {isCurrent && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-[#25D366] text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Current plan
                          </span>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{plan.name}</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">
                            {plan.price}<span className="text-sm font-normal text-slate-400">/mo</span>
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">{plan.description}</p>
                        </div>
                        <div className="space-y-1.5 flex-1">
                          {[
                            isUnlimited ? 'Unlimited WhatsApp messages' : `${plan.messages.toLocaleString()} messages/mo`,
                            'Facebook Lead Ads sync',
                            'Lead quality tracking',
                            'Ad attribution analytics',
                            'WhatsApp follow-ups',
                          ].map(f => (
                            <div key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" />
                              {f}
                            </div>
                          ))}
                        </div>
                        {isCurrent ? (
                          <div className="text-center text-xs font-semibold text-[#25D366] py-2">Active</div>
                        ) : isPending ? (
                          <div className="text-center text-xs font-semibold text-amber-600 py-2">Payment pending…</div>
                        ) : !canManageBilling ? (
                          <div className="text-center text-xs text-slate-400 py-2">Ask an admin to change plans</div>
                        ) : (
                          <button
                            onClick={() => handleSubscribe(plan.id)}
                            disabled={subscribingPlan !== null}
                            className={cn(
                              'text-center text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-60',
                              isRecommended
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-[#25D366] hover:bg-[#128C7E] text-white'
                            )}
                          >
                            {subscribingPlan === plan.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <>{isDowngrade ? 'Downgrade' : 'Upgrade'} →</>}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ── Cancel subscription modal ────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-overlay-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-y-auto sm:overflow-hidden max-h-[90vh] sm:max-h-none animate-sheet-up sm:animate-none pb-[env(safe-area-inset-bottom)] sm:pb-0">
            <div className="sm:hidden sticky top-0 z-10 bg-white flex justify-center pt-2.5 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <h2 className="font-semibold text-gray-900">Cancel subscription</h2>
              </div>
              <button
                onClick={() => { setShowCancelModal(false); setCancelError('') }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Your plan will be cancelled immediately — you'll lose access to WhatsApp automation,
                Facebook Lead Ads sync, and campaign sending right away. This can't be undone; you'll
                need to subscribe again to restore access.
              </p>

              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Why are you cancelling? <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={cancelReason}
                onChange={setCancelReason}
                placeholder="Select a reason…"
                className="mb-3"
                buttonClassName="focus:ring-red-200"
                options={[
                  { value: 'too_expensive',     label: 'Too expensive' },
                  { value: 'not_using',         label: 'Not using it enough' },
                  { value: 'missing_features',  label: 'Missing features I need' },
                  { value: 'switching',         label: 'Switching to another tool' },
                  { value: 'technical_issues',  label: 'Technical issues' },
                  { value: 'other',             label: 'Other' },
                ]}
              />

              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Anything else you'd like to share? <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={cancelDetail}
                onChange={e => setCancelDetail(e.target.value)}
                rows={3}
                className="w-full text-base px-3 py-2.5 border border-slate-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                placeholder="Tell us more…"
              />

              {cancelError && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600">{cancelError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCancelModal(false); setCancelError('') }}
                  className="flex-1 text-sm font-semibold text-slate-600 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                >
                  Keep subscription
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 text-sm font-semibold text-white py-2.5 rounded-lg bg-red-500 hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel subscription'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Team Members ─────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          {/* Invite form */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Invite Team Member
            </h2>
            <p className="text-slate-400 text-xs mb-4 ml-9">Invite colleagues to help manage your Wapaci account</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email address
                </label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="colleague@yourstore.com"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
              </div>
              <div className="w-full sm:w-40 sm:flex-shrink-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <CustomSelect value={inviteRole} onChange={setInviteRole} options={ROLE_OPTIONS} />
              </div>
              <div className="flex sm:items-end">
                <button onClick={handleInvite} disabled={sendingInvite || !inviteEmail.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap">
                  {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {sendingInvite ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              <strong>Role permissions:</strong> Admin (full access) · Manager (automations, campaigns, customers) · Sales (leads &amp; contacts) · Support (conversations only)
            </div>
          </section>

          {/* Members list */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Team Members</h3>
              <button onClick={loadMembers} disabled={loadingMembers}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition">
                <RefreshCw className={cn('w-3.5 h-3.5', loadingMembers && 'animate-spin')} />
              </button>
            </div>

            {/* Show the current viewer as "Owner" only when they actually are — derived
                from teamActivity (owner/admin only; null for everyone else, who by
                definition of that gate can't be the owner either). This used to render
                unconditionally for whoever was logged in, so an invited Sales rep saw
                themselves labeled "Owner · Full access" on their own Settings page. */}
            {(teamActivity?.some(p => p.role === 'owner' && p.email === userEmail) ?? false) && (
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {userEmail[0]?.toUpperCase() ?? 'Y'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{userEmail}</p>
                    <p className="text-xs text-slate-400">Owner · Full access</p>
                  </div>
                </div>
                <span className="text-xs bg-[#25D366]/10 text-[#25D366] font-semibold px-2.5 py-1 rounded-full flex-shrink-0">Owner</span>
              </div>
            )}

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">No team members yet. Invite someone above.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
                        m.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {m.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.email}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <div className="relative inline-flex items-center" data-role-menu={m.id}>
                            <button
                              type="button"
                              disabled={changingRoleId === m.id}
                              onClick={() => setOpenRoleMenuId(openRoleMenuId === m.id ? null : m.id)}
                              className={cn(
                                // text-base (not text-[10px]) to avoid iOS Safari's
                                // auto-zoom-on-focus on sub-16px inputs; py-1.5 (not
                                // py-0.5) to bring the tappable height closer to the
                                // ~40px touch-target guideline on a dense mobile row.
                                'text-base font-medium pl-2.5 pr-7 py-1.5 rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-wait border-0 focus:outline-none focus:ring-1 focus:ring-offset-1',
                                ROLE_COLORS[m.role] ?? ROLE_COLORS.member
                              )}>
                              {ROLE_OPTIONS.find(o => o.value === m.role)?.label ?? m.role}
                            </button>
                            {changingRoleId === m.id
                              ? <Loader2 className="w-3 h-3 animate-spin absolute right-2 pointer-events-none" />
                              : <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none" />}
                            {openRoleMenuId === m.id && (
                              <div className="absolute z-20 top-full left-0 mt-1.5 min-w-[110px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1">
                                {ROLE_OPTIONS.map(o => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => { handleChangeRole(m.id, o.value); setOpenRoleMenuId(null) }}
                                    className={cn(
                                      'w-full px-3 py-2 text-left text-sm transition whitespace-nowrap',
                                      o.value === m.role ? 'bg-[#25D366]/5 text-[#128C7E] font-medium' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                  >
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
                      className="text-slate-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                      {removingId === m.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Lead Distribution */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-purple-600" />
              </div>
              Lead Distribution
            </h3>
            <p className="text-slate-400 text-xs mb-5 ml-9">Control how new leads are assigned to your sales team</p>

            <div className="space-y-2 mb-5">
              {([
                { value: 'manual',      label: 'Manual',      desc: 'You assign leads yourself. New leads sit unassigned until you pick someone from the lead card.' },
                { value: 'open_pool',   label: 'Open Pool',   desc: 'All team members see all unassigned leads. First to claim it gets it — no auto-assignment.' },
                { value: 'round_robin', label: 'Round Robin', desc: 'New leads are auto-assigned evenly across your team in rotation. Set the order below.' },
              ] as const).map(opt => (
                <label key={opt.value} className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition',
                  distMode === opt.value ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input type="radio" name="distMode" value={opt.value}
                    checked={distMode === opt.value}
                    onChange={() => setDistMode(opt.value)}
                    className="mt-0.5 accent-[#25D366]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {distMode === 'open_pool' && (
              <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                All active team members will see unclaimed leads in their Leads tab. The first person to open and call a lead claims it.
              </div>
            )}

            {distMode === 'round_robin' && (
              <div className="mb-5">
                <p className="text-xs font-medium text-slate-600 mb-2">Assignment order</p>
                {distMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
                    No active team members yet. Invite members above to set up round robin.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {distMembers.map((m, i) => (
                      <div key={m.user_id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm text-slate-700 truncate">{m.email}</span>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button
                            disabled={i === 0}
                            onClick={() => setDistMembers(prev => {
                              const next = [...prev]
                              ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                              return next
                            })}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition">
                            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button
                            disabled={i === distMembers.length - 1}
                            onClick={() => setDistMembers(prev => {
                              const next = [...prev]
                              ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                              return next
                            })}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition">
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-2">Use arrows to adjust assignment priority. Changes reset the rotation counter.</p>
              </div>
            )}

            <button onClick={saveDist} disabled={savingDist}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition">
              {savingDist
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <><Save className="w-3.5 h-3.5" /> Save distribution settings</>}
            </button>
          </section>

          {/* Team Activity — owner/admin only. teamActivity stays null (section hidden)
              for anyone the API 403s, so a sales rep with Settings access never sees
              teammates' individual numbers. */}
          {teamActivity && teamActivity.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
              <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                Team Activity
              </h3>
              <p className="text-slate-400 text-xs mb-5 ml-9">Who's working which leads, and how much</p>

              {loadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {[...teamActivity]
                    .sort((a, b) => b.calls_logged - a.calls_logged)
                    .map(person => {
                      const conversionRate = person.leads_assigned > 0
                        ? Math.round((person.converted / person.leads_assigned) * 100)
                        : 0
                      return (
                        <div key={person.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {person.email[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-medium text-slate-800 truncate">{person.email}</p>
                                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize flex-shrink-0', ROLE_COLORS[person.role] ?? ROLE_COLORS.member)}>
                                  {person.role === 'member' ? 'Sales' : person.role}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {person.last_activity_at ? `Last call ${timeAgo(person.last_activity_at)}` : 'No calls logged yet'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-4 flex-shrink-0 text-right pl-12 sm:pl-0 sm:ml-auto">
                            <div>
                              <p className="text-sm font-semibold text-slate-800 tabular-nums flex items-center gap-1 justify-end">
                                <Phone className="w-3 h-3 text-slate-400" /> {person.calls_logged}
                              </p>
                              <p className="text-[10px] text-slate-400">calls</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 tabular-nums">{person.leads_assigned}</p>
                              <p className="text-[10px] text-slate-400">leads</p>
                            </div>
                            <div>
                              <p className={cn('text-sm font-semibold tabular-nums flex items-center gap-1 justify-end',
                                conversionRate > 0 ? 'text-emerald-600' : 'text-slate-800')}>
                                <Target className="w-3 h-3 text-slate-400" /> {conversionRate}%
                              </p>
                              <p className="text-[10px] text-slate-400">converted</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              Change Password
            </h2>
            <p className="text-slate-500 text-sm mb-4">Enter your current password and choose a new one.</p>
            <div className="space-y-3 max-w-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {changingPassword
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</>
                  : <><Lock className="w-4 h-4" /> Change password</>}
              </button>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Two-Factor Authentication
            </h2>
            <p className="text-slate-400 text-xs mb-4 ml-9">Add an extra layer of security</p>
            <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm">Authenticator App</p>
                <p className="text-slate-400 text-xs mt-0.5">Use Google Authenticator or similar</p>
              </div>
              <span className="text-xs bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full font-medium flex-shrink-0 whitespace-nowrap">Coming soon</span>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 sm:p-6">
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

'use client'

import { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, TrendingUp, Loader2, Search, RefreshCw,
  CheckCircle2, XCircle, Zap, Phone, Building2,
  ChevronDown, ChevronUp, LogOut, Shield, CreditCard,
  MessageSquare, Store, Crown, AlertTriangle, Ban,
  ArrowUpRight, Activity, DollarSign, UserMinus, Edit2,
  X, Copy, Mail, Calendar, CheckCheck, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PLAN_PRICES: Record<string, number> = { starter: 999, growth: 2999, pro: 7999 }
const PLAN_COLORS: Record<string, string> = {
  trial:   'bg-slate-700 text-slate-300',
  starter: 'bg-blue-900/50 text-blue-300',
  growth:  'bg-green-900/50 text-green-300',
  pro:     'bg-purple-900/50 text-purple-300',
}
const STATUS_COLORS: Record<string, string> = {
  trialing:  'bg-blue-900/40 text-blue-400',
  active:    'bg-green-900/40 text-green-400',
  cancelled: 'bg-red-900/40 text-red-400',
  past_due:  'bg-amber-900/40 text-amber-400',
}

interface AdminUser {
  id: string
  email: string
  email_confirmed: boolean
  signed_up_at: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  team_size: string | null
  store_domain: string | null
  store_name: string | null
  store_active: boolean
  whatsapp_bsp: string | null
  whatsapp_number: string | null
  active_automations: number
  messages_30d: number
  billing_plan: string | null
  billing_status: string | null
  billing_amount: number
  messages_used: number
  messages_limit: number
  has_subscription: boolean
  razorpay_sub_id: string | null
  next_billing_date: string | null
  cancelled_at: string | null
}

interface Stats {
  total_signups: number
  new_this_week: number
  email_confirmed: number
  stores_connected: number
  total_messages_30d: number
  active_subscriptions: number
  mrr_inr: number
  organizations: number
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function copy(text: string) { navigator.clipboard.writeText(text).catch(() => null) }

type Tab = 'overview' | 'users' | 'revenue'
type ActionType = 'plan' | 'cancel' | 'remove' | null

export default function AdminPage() {
  const [users,       setUsers]       = useState<AdminUser[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<Tab>('overview')
  const [search,      setSearch]      = useState('')
  const [planFilter,  setPlanFilter]  = useState('all')
  const [statusFilter,setStatusFilter]= useState('all')
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [actionUser,  setActionUser]  = useState<AdminUser | null>(null)
  const [actionType,  setActionType]  = useState<ActionType>(null)
  const [newPlan,     setNewPlan]     = useState('')
  const [actioning,   setActioning]   = useState(false)
  const [actionError, setActionError] = useState('')
  const [sortBy,      setSortBy]      = useState<'signed_up_at' | 'messages_30d' | 'billing_amount'>('signed_up_at')
  const [sortAsc,     setSortAsc]     = useState(false)
  const [fetchError,  setFetchError]  = useState<string | null>(null)

  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const res  = await fetch('/api/admin/users')
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 403) { router.replace('/admin/login'); return }
      setFetchError(data.detail ?? data.error ?? `HTTP ${res.status}`)
      setLoading(false)
      return
    }
    setUsers(data.users ?? [])
    setStats(data.stats ?? null)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return users
      .filter(u => planFilter   === 'all' || (u.billing_plan   ?? 'trial') === planFilter)
      .filter(u => statusFilter === 'all' || (u.billing_status ?? 'none')  === statusFilter)
      .filter(u => !s || u.email?.toLowerCase().includes(s)
                      || u.full_name?.toLowerCase().includes(s)
                      || u.company_name?.toLowerCase().includes(s)
                      || u.phone?.includes(s))
      .sort((a, b) => {
        const av = sortBy === 'signed_up_at' ? a.signed_up_at : sortBy === 'messages_30d' ? a.messages_30d : a.billing_amount
        const bv = sortBy === 'signed_up_at' ? b.signed_up_at : sortBy === 'messages_30d' ? b.messages_30d : b.billing_amount
        if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      })
  }, [users, search, planFilter, statusFilter, sortBy, sortAsc])

  function openAction(u: AdminUser, type: ActionType) {
    setActionUser(u)
    setActionType(type)
    setActionError('')
    if (type === 'plan') setNewPlan(u.billing_plan ?? 'trial')
  }

  async function doAction() {
    if (!actionUser || !actionType) return
    setActioning(true)
    setActionError('')

    if (actionType === 'remove' && !confirm(`Permanently disable account for ${actionUser.email}?`)) {
      setActioning(false)
      return
    }

    const action =
      actionType === 'plan'   ? 'change_plan'          :
      actionType === 'cancel' ? 'cancel_subscription'  :
                                'remove_user'

    const res  = await fetch('/api/admin/action', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, user_id: actionUser.id, plan: newPlan }),
    })
    const data = await res.json()
    setActioning(false)

    if (!res.ok) { setActionError(data.error ?? 'Action failed'); return }

    setActionUser(null)
    setActionType(null)
    await load()
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  if (fetchError) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-8">
      <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 max-w-lg w-full text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-white font-bold text-lg mb-2">Failed to load users</h2>
        <p className="text-red-300 text-sm mb-4 font-mono bg-black/30 rounded-xl px-4 py-3">{fetchError}</p>
        <p className="text-slate-400 text-sm mb-6">
          Most likely cause: <span className="text-amber-300 font-semibold">SUPABASE_SERVICE_ROLE_KEY</span> is missing or incorrect in your Vercel environment variables.
          <br /><br />
          Go to <span className="text-white font-mono">Vercel → Project → Settings → Environment Variables</span> and confirm <code className="bg-white/10 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set, then redeploy.
        </p>
        <button onClick={load} className="bg-[#25D366] hover:bg-[#128C7E] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">
          Retry
        </button>
      </div>
    </div>
  )

  const arr = (stats?.mrr_inr ?? 0) * 12

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">

      {/* Top bar */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0d1117]/95 backdrop-blur z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-white">Wapaci Admin</span>
            <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">Master</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block">{stats?.total_signups ?? 0} total users</span>
          <button onClick={load} title="Refresh" className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { supabase.auth.signOut(); router.push('/admin/login') }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-500/10">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1 mb-8 w-fit">
          {(['overview', 'users', 'revenue'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-5 py-2 rounded-xl text-sm font-medium transition capitalize',
                tab === t ? 'bg-[#25D366] text-white shadow' : 'text-slate-400 hover:text-white')}>
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Monthly Revenue (MRR)', value: `₹${stats.mrr_inr.toLocaleString('en-IN')}`, icon: DollarSign,    color: 'text-green-400',  bg: 'bg-green-500/10',  sub: `ARR ₹${arr.toLocaleString('en-IN')}` },
                { label: 'Active Subscribers',    value: String(stats.active_subscriptions),           icon: Crown,         color: 'text-amber-400',  bg: 'bg-amber-500/10',  sub: `of ${stats.total_signups} total users` },
                { label: 'Total Signups',          value: String(stats.total_signups),                 icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10',   sub: `+${stats.new_this_week} this week` },
                { label: 'Email Confirmed',        value: String(stats.email_confirmed),               icon: CheckCheck,    color: 'text-[#25D366]',  bg: 'bg-[#25D366]/10',  sub: `${stats.total_signups - stats.email_confirmed} unconfirmed` },
                { label: 'Messages Sent (30d)',    value: String(stats.total_messages_30d),            icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10', sub: 'across all stores' },
                { label: 'Stores Connected',       value: String(stats.stores_connected),              icon: Store,         color: 'text-orange-400', bg: 'bg-orange-500/10', sub: `${stats.total_signups - stats.stores_connected} not yet connected` },
                { label: 'Conversion (free→paid)', value: `${stats.total_signups ? Math.round((stats.active_subscriptions / stats.total_signups) * 100) : 0}%`, icon: ArrowUpRight, color: 'text-sky-400', bg: 'bg-sky-500/10', sub: 'trial to paid' },
                { label: 'Organizations',          value: String(stats.organizations),                 icon: Building2,     color: 'text-rose-400',   bg: 'bg-rose-500/10',   sub: 'with team members' },
              ].map(({ label, value, icon: Icon, color, bg, sub }) => (
                <div key={label} className="bg-white/3 border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">{label}</p>
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
                      <Icon className={cn('w-4 h-4', color)} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-slate-600 text-xs mt-1">{sub}</p>
                </div>
              ))}
            </div>

            {/* Sales call list — signed up, no subscription, have phone */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" /> Sales Call List
              </h3>
              <p className="text-slate-500 text-xs mb-4">Signed up, no active subscription — call these leads</p>
              <div className="space-y-2">
                {users.filter(u => !u.has_subscription && u.phone).slice(0, 15).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2.5 px-3 bg-white/3 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                        {u.full_name?.[0]?.toUpperCase() ?? u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{u.full_name ?? u.email}</p>
                        <p className="text-xs text-slate-500 truncate">{u.company_name ?? 'No company'} · {timeAgo(u.signed_up_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm text-amber-300 font-mono">{u.phone}</span>
                      <button onClick={() => copy(u.phone ?? '')} title="Copy phone" className="text-slate-500 hover:text-white">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {users.filter(u => !u.has_subscription && u.phone).length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No leads with phone numbers yet</p>
                )}
              </div>
            </div>

            {/* Recent signups */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#25D366]" /> Latest Signups
              </h3>
              <div className="space-y-2">
                {users.slice(0, 10).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', u.email_confirmed ? 'bg-green-500' : 'bg-amber-500')} title={u.email_confirmed ? 'Email confirmed' : 'Not confirmed'} />
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{u.full_name ?? u.email}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {u.phone && <span className="text-xs text-slate-400 font-mono hidden sm:block">{u.phone}</span>}
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLORS[u.billing_plan ?? 'trial'] ?? PLAN_COLORS.trial)}>
                        {u.billing_plan ?? 'trial'}
                      </span>
                      <span className="text-xs text-slate-500">{timeAgo(u.signed_up_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email, company, phone…"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-600" />
              </div>
              <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                className="bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]">
                <option value="all">All plans</option>
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="cancelled">Cancelled</option>
                <option value="past_due">Past due</option>
              </select>
              <p className="text-slate-500 text-sm">{filtered.length} / {users.length} users</p>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold">User</th>
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold hidden md:table-cell">Phone</th>
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold">Plan / Status</th>
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold hidden lg:table-cell">
                        <button className="flex items-center gap-1 hover:text-white" onClick={() => { setSortBy('messages_30d'); setSortAsc(s => !s) }}>
                          Msgs 30d {sortBy === 'messages_30d' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold hidden xl:table-cell">Usage</th>
                      <th className="text-left px-4 py-3 text-slate-400 text-xs font-semibold hidden xl:table-cell">
                        <button className="flex items-center gap-1 hover:text-white" onClick={() => { setSortBy('signed_up_at'); setSortAsc(s => !s) }}>
                          Joined {sortBy === 'signed_up_at' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-slate-500 py-12">No users found</td></tr>
                    ) : filtered.map(u => (
                      <Fragment key={u.id}>
                        <tr className="hover:bg-white/3 transition cursor-pointer" onClick={() => setExpanded(expanded === u.id ? null : u.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', u.email_confirmed ? 'bg-green-500' : 'bg-amber-500')} title={u.email_confirmed ? 'Confirmed' : 'Email not confirmed'} />
                              <div>
                                <p className="text-white font-medium text-sm">{u.full_name ?? '—'}</p>
                                <p className="text-slate-500 text-xs">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {u.phone ? (
                              <button onClick={e => { e.stopPropagation(); copy(u.phone!) }}
                                className="flex items-center gap-1.5 text-amber-300 text-sm font-mono hover:text-amber-200 group">
                                {u.phone}
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                              </button>
                            ) : <span className="text-slate-600 text-xs">No phone</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize w-fit', PLAN_COLORS[u.billing_plan ?? 'trial'] ?? PLAN_COLORS.trial)}>
                                {u.billing_plan ?? 'trial'}
                              </span>
                              {u.billing_status && (
                                <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize w-fit', STATUS_COLORS[u.billing_status] ?? 'bg-slate-700 text-slate-400')}>
                                  {u.billing_status}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className={cn('text-sm font-semibold', u.messages_30d > 0 ? 'text-white' : 'text-slate-600')}>{u.messages_30d.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {u.messages_limit > 0 ? (
                              <div className="w-24">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                  <span>{u.messages_used}</span>
                                  <span>{u.messages_limit}</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full', (u.messages_used / u.messages_limit) > 0.8 ? 'bg-red-500' : 'bg-[#25D366]')}
                                    style={{ width: `${Math.min(100, Math.round((u.messages_used / u.messages_limit) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <p className="text-slate-400 text-xs">{timeAgo(u.signed_up_at)}</p>
                            <p className="text-slate-600 text-[10px]">{fmtDate(u.signed_up_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openAction(u, 'plan')}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition" title="Change plan">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {u.has_subscription && u.billing_status !== 'cancelled' && (
                                <button onClick={() => openAction(u, 'cancel')}
                                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition" title="Cancel subscription">
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => openAction(u, 'remove')}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition" title="Disable account">
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-slate-700 ml-1">
                                {expanded === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expanded === u.id && (
                          <tr className="bg-white/2">
                            <td colSpan={7} className="px-4 py-5">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 text-sm">
                                <div>
                                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                                  {u.phone ? (
                                    <button onClick={() => copy(u.phone!)} className="text-amber-300 font-mono flex items-center gap-1 hover:text-amber-200">
                                      {u.phone} <Copy className="w-3 h-3" />
                                    </button>
                                  ) : <p className="text-slate-600">No phone</p>}
                                </div>
                                <div>
                                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                                  <button onClick={() => copy(u.email)} className="text-white flex items-center gap-1 hover:text-slate-300">
                                    {u.email} <Copy className="w-3 h-3" />
                                  </button>
                                  <p className="text-[10px] mt-0.5">{u.email_confirmed ? <span className="text-green-500">✓ Confirmed</span> : <span className="text-amber-500">Not confirmed</span>}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1"><Store className="w-3 h-3" /> Store</p>
                                  <p className="text-white">{u.store_name ?? '—'}</p>
                                  {u.store_domain && <p className="text-slate-500 text-xs font-mono">{u.store_domain}</p>}
                                  {u.whatsapp_bsp && <p className="text-slate-500 text-[10px] mt-0.5">WA: {u.whatsapp_bsp} {u.whatsapp_number ? `· ${u.whatsapp_number}` : ''}</p>}
                                </div>
                                <div>
                                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Usage</p>
                                  <p className="text-white">{u.active_automations} automations active</p>
                                  <p className="text-slate-400 text-xs">{u.messages_used.toLocaleString()} / {u.messages_limit.toLocaleString()} msgs used</p>
                                  <p className="text-slate-400 text-xs">{u.messages_30d} sent last 30d</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Billing</p>
                                  <p className="text-white">₹{PLAN_PRICES[u.billing_plan ?? ''] ?? 0}/mo</p>
                                  {u.next_billing_date && <p className="text-slate-400 text-xs">Next: {fmtDate(u.next_billing_date)}</p>}
                                  {u.cancelled_at && <p className="text-red-400 text-xs">Cancelled: {fmtDate(u.cancelled_at)}</p>}
                                  {u.razorpay_sub_id && (
                                    <button onClick={() => copy(u.razorpay_sub_id!)} className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1 mt-1 font-mono">
                                      {u.razorpay_sub_id.slice(0, 20)}… <Copy className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <p className="text-slate-500 text-[10px]">Team size: {u.team_size ?? '—'} · Company: {u.company_name ?? '—'} · Joined: {fmtDate(u.signed_up_at)}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE ──────────────────────────────────────────────────────── */}
        {tab === 'revenue' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Revenue by Plan</h3>
              <div className="space-y-4">
                {['starter', 'growth', 'pro'].map(plan => {
                  const count = users.filter(u => u.billing_plan === plan && u.billing_status === 'active').length
                  const rev   = count * (PLAN_PRICES[plan] ?? 0)
                  const pct   = stats.mrr_inr ? Math.round((rev / stats.mrr_inr) * 100) : 0
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="capitalize text-white font-medium">{plan}</span>
                        <span className="text-slate-400">₹{rev.toLocaleString('en-IN')} · {count} users</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2">
                        <div className="h-2 rounded-full bg-[#25D366]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-white/8 space-y-2">
                {[
                  { label: 'MRR', val: `₹${stats.mrr_inr.toLocaleString('en-IN')}` },
                  { label: 'ARR', val: `₹${arr.toLocaleString('en-IN')}` },
                  { label: 'Avg revenue / subscriber', val: `₹${stats.active_subscriptions ? Math.round(stats.mrr_inr / stats.active_subscriptions).toLocaleString('en-IN') : 0}` },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="text-white font-bold">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Subscription Health</h3>
              <div className="space-y-4">
                {[
                  { label: 'Active',         count: users.filter(u => u.billing_status === 'active').length,    color: 'bg-green-500',  icon: CheckCircle2,   cls: 'text-green-400'  },
                  { label: 'Trialing',        count: users.filter(u => u.billing_status === 'trialing').length,  color: 'bg-blue-500',   icon: Activity,       cls: 'text-blue-400'   },
                  { label: 'Cancelled',       count: users.filter(u => u.billing_status === 'cancelled').length, color: 'bg-red-500',    icon: XCircle,        cls: 'text-red-400'    },
                  { label: 'Past Due',        count: users.filter(u => u.billing_status === 'past_due').length,  color: 'bg-amber-500',  icon: AlertTriangle,  cls: 'text-amber-400'  },
                  { label: 'No billing yet',  count: users.filter(u => !u.billing_status).length,               color: 'bg-slate-500',  icon: UserMinus,      cls: 'text-slate-400'  },
                ].map(({ label, count, color, icon: Icon, cls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', cls)} />
                      <span className="text-slate-300 text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-white/5 rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full', color)} style={{ width: `${users.length ? (count / users.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-white text-sm font-medium w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-white/8">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Free → paid conversion</span>
                  <span className="text-white font-bold">
                    {stats.total_signups ? Math.round((stats.active_subscriptions / stats.total_signups) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue table — all paying users */}
            <div className="md:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> All Paying Customers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left py-2 text-slate-500 text-xs">User</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Phone</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Plan</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Revenue/mo</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Status</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Next billing</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Msgs used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.filter(u => u.has_subscription).map(u => (
                      <tr key={u.id} className="hover:bg-white/3 transition">
                        <td className="py-2.5">
                          <p className="text-white text-sm">{u.full_name ?? u.email}</p>
                          <p className="text-slate-500 text-xs">{u.company_name ?? u.email}</p>
                        </td>
                        <td className="py-2.5">
                          <span className="text-amber-300 text-sm font-mono">{u.phone ?? '—'}</span>
                        </td>
                        <td className="py-2.5">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLORS[u.billing_plan ?? 'trial'] ?? PLAN_COLORS.trial)}>
                            {u.billing_plan ?? 'trial'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className="text-green-400 font-bold">₹{PLAN_PRICES[u.billing_plan ?? ''] ?? 0}</span>
                        </td>
                        <td className="py-2.5">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[u.billing_status ?? ''] ?? 'bg-slate-700 text-slate-400')}>
                            {u.billing_status ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400 text-xs">{fmtDate(u.next_billing_date)}</td>
                        <td className="py-2.5">
                          <span className="text-slate-300 text-xs">{u.messages_used.toLocaleString()} / {u.messages_limit.toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                    {users.filter(u => u.has_subscription).length === 0 && (
                      <tr><td colSpan={7} className="text-center text-slate-500 py-8">No paying customers yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action Modal ─────────────────────────────────────────────────────── */}
      {actionUser && actionType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2332] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                {actionType === 'plan'   && 'Change Plan'}
                {actionType === 'cancel' && 'Cancel Subscription'}
                {actionType === 'remove' && 'Disable Account'}
              </h3>
              <button onClick={() => { setActionUser(null); setActionType(null) }} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white/5 rounded-xl p-3 mb-4">
              <p className="text-white text-sm font-medium">{actionUser.full_name ?? actionUser.email}</p>
              <p className="text-slate-400 text-xs">{actionUser.email}</p>
              {actionUser.phone && <p className="text-amber-300 text-xs font-mono mt-0.5">{actionUser.phone}</p>}
            </div>

            {actionType === 'plan' && (
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] mb-4">
                <option value="trial">Trial (free)</option>
                <option value="starter">Starter — ₹999/mo</option>
                <option value="growth">Growth — ₹2,999/mo</option>
                <option value="pro">Pro — ₹7,999/mo</option>
              </select>
            )}

            {actionType === 'cancel' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300">
                This will cancel their Razorpay subscription at end of current billing cycle. They keep access until then.
              </div>
            )}

            {actionType === 'remove' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-300">
                This will deactivate their store and mark their subscription as cancelled. The auth account remains — contact Supabase support for full deletion.
              </div>
            )}

            {actionError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {actionError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setActionUser(null); setActionType(null) }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition">
                Cancel
              </button>
              <button onClick={doAction} disabled={actioning}
                className={cn('flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50',
                  actionType === 'remove' ? 'bg-red-600 hover:bg-red-700' :
                  actionType === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' :
                                           'bg-[#25D366] hover:bg-[#128C7E]')}>
                {actioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {actionType === 'plan'   && 'Save plan'}
                {actionType === 'cancel' && 'Cancel subscription'}
                {actionType === 'remove' && 'Disable account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

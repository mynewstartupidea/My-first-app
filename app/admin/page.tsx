'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, TrendingUp, Loader2, Search, RefreshCw,
  CheckCircle2, XCircle, Zap, Calendar, Phone, Building2,
  ChevronDown, ChevronUp, LogOut, Shield, CreditCard,
  MessageSquare, Store, Crown, AlertTriangle, Ban,
  ArrowUpRight, Activity, DollarSign, UserMinus, Edit2, X
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
  id: string; full_name: string | null; company_name: string | null
  phone: string | null; team_size: string | null; email: string | null
  signed_up_at: string; store_domain: string | null; store_name: string | null
  store_active: boolean; whatsapp_bsp: string | null
  active_automations: number; messages_30d: number
  billing_plan: string | null; billing_status: string | null
  billing_amount: number; has_subscription: boolean
}

interface Stats {
  total_signups: number; new_this_week: number; stores_connected: number
  total_messages_30d: number; active_subscriptions: number
  mrr_inr: number; organizations: number
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

type Tab = 'overview' | 'users' | 'revenue'

export default function AdminPage() {
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('overview')
  const [search, setSearch]       = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [actionUser, setActionUser] = useState<AdminUser | null>(null)
  const [actionType, setActionType] = useState<'plan' | 'remove' | null>(null)
  const [newPlan, setNewPlan]     = useState('')
  const [actioning, setActioning] = useState(false)
  const [sortBy, setSortBy]       = useState<'signed_up_at' | 'messages_30d' | 'billing_amount'>('signed_up_at')
  const [sortAsc, setSortAsc]     = useState(false)

  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (!res.ok) { router.replace('/admin/login'); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setStats(data.stats ?? null)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return users
      .filter(u => planFilter === 'all' || (u.billing_plan ?? 'trial') === planFilter)
      .filter(u => !s || u.email?.toLowerCase().includes(s) || u.full_name?.toLowerCase().includes(s) || u.company_name?.toLowerCase().includes(s))
      .sort((a, b) => {
        const av = sortBy === 'signed_up_at' ? a.signed_up_at : sortBy === 'messages_30d' ? a.messages_30d : a.billing_amount
        const bv = sortBy === 'signed_up_at' ? b.signed_up_at : sortBy === 'messages_30d' ? b.messages_30d : b.billing_amount
        if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      })
  }, [users, search, planFilter, sortBy, sortAsc])

  async function handleChangePlan() {
    if (!actionUser || !newPlan) return
    setActioning(true)
    await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_plan', user_id: actionUser.id, plan: newPlan }),
    })
    setActionUser(null); setActionType(null); setNewPlan('')
    setActioning(false)
    await load()
  }

  async function handleRemoveUser() {
    if (!actionUser) return
    if (!confirm(`Permanently remove ${actionUser.email}? This cannot be undone.`)) return
    setActioning(true)
    await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_user', user_id: actionUser.id }),
    })
    setActionUser(null); setActionType(null)
    setActioning(false)
    await load()
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  const arr = (stats?.mrr_inr ?? 0) * 12
  const avgRevPerUser = stats?.total_signups ? Math.round((stats.mrr_inr ?? 0) / Math.max(1, stats.active_subscriptions)) : 0

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
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <Activity className="w-3 h-3" /> Live
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { supabase.auth.signOut(); router.push('/admin/login') }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-500/10"
          >
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

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Monthly Revenue',    value: `₹${stats.mrr_inr.toLocaleString('en-IN')}`,         icon: DollarSign,    color: 'text-green-400',  bg: 'bg-green-500/10',  sub: `ARR ₹${(arr).toLocaleString('en-IN')}` },
                { label: 'Active Subscribers', value: String(stats.active_subscriptions),                    icon: Crown,         color: 'text-amber-400',  bg: 'bg-amber-500/10',  sub: `of ${stats.total_signups} total users` },
                { label: 'Total Users',         value: String(stats.total_signups),                          icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10',   sub: `+${stats.new_this_week} this week` },
                { label: 'Messages (30d)',       value: String(stats.total_messages_30d),                    icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10', sub: 'across all stores' },
                { label: 'Stores Connected',    value: String(stats.stores_connected),                      icon: Store,         color: 'text-orange-400', bg: 'bg-orange-500/10', sub: `${stats.total_signups - stats.stores_connected} not connected` },
                { label: 'Avg Revenue / Sub',   value: `₹${avgRevPerUser.toLocaleString('en-IN')}`,         icon: TrendingUp,    color: 'text-sky-400',    bg: 'bg-sky-500/10',    sub: 'per paying subscriber' },
                { label: 'Conversion Rate',     value: `${stats.total_signups ? Math.round((stats.active_subscriptions / stats.total_signups) * 100) : 0}%`, icon: ArrowUpRight, color: 'text-[#25D366]', bg: 'bg-[#25D366]/10', sub: 'free → paid' },
                { label: 'Organizations',        value: String(stats.organizations),                         icon: Building2,     color: 'text-rose-400',   bg: 'bg-rose-500/10',   sub: 'with team members' },
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

            {/* Recent signups */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#25D366]" /> Recent Signups
              </h3>
              <div className="space-y-2">
                {users.slice(0, 8).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-bold text-xs">
                        {u.full_name?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{u.full_name ?? u.email}</p>
                        <p className="text-xs text-slate-500">{u.company_name ?? 'No company'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', PLAN_COLORS[u.billing_plan ?? 'trial'] ?? PLAN_COLORS.trial)}>
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

        {/* ── USERS TAB ────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, company…"
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
              <p className="text-slate-500 text-sm">{filtered.length} users</p>
            </div>

            {/* Table */}
            <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold">User</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold hidden md:table-cell">Company</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold">Plan</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold hidden lg:table-cell">
                        <button className="flex items-center gap-1 hover:text-white transition" onClick={() => { setSortBy('messages_30d'); setSortAsc(s => !s) }}>
                          Msgs 30d {sortBy === 'messages_30d' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </button>
                      </th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold hidden xl:table-cell">
                        <button className="flex items-center gap-1 hover:text-white transition" onClick={() => { setSortBy('signed_up_at'); setSortAsc(s => !s) }}>
                          Joined {sortBy === 'signed_up_at' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-slate-400 text-xs font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-slate-500 py-12">No users found</td></tr>
                    ) : filtered.map(u => (
                      <>
                        <tr key={u.id} className="hover:bg-white/3 transition cursor-pointer" onClick={() => setExpanded(expanded === u.id ? null : u.id)}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-bold text-xs flex-shrink-0">
                                {u.full_name?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{u.full_name ?? '—'}</p>
                                <p className="text-slate-500 text-xs">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <p className="text-slate-300 text-sm">{u.company_name ?? '—'}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLORS[u.billing_plan ?? 'trial'] ?? PLAN_COLORS.trial)}>
                                {u.billing_plan ?? 'trial'}
                              </span>
                              {u.billing_status && (
                                <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[u.billing_status] ?? 'bg-slate-700 text-slate-400')}>
                                  {u.billing_status}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 hidden lg:table-cell">
                            <span className={cn('text-sm font-semibold', u.messages_30d > 0 ? 'text-white' : 'text-slate-600')}>{u.messages_30d}</span>
                          </td>
                          <td className="px-5 py-3.5 hidden xl:table-cell">
                            <p className="text-slate-400 text-xs">{timeAgo(u.signed_up_at)}</p>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); setActionUser(u); setActionType('plan'); setNewPlan(u.billing_plan ?? 'trial') }}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                                title="Change plan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setActionUser(u); setActionType('remove') }}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                title="Remove user"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-slate-700">{expanded === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                            </div>
                          </td>
                        </tr>
                        {expanded === u.id && (
                          <tr key={`${u.id}-detail`} className="bg-white/2">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                                  <p className="text-white">{u.phone ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Store className="w-3 h-3" /> Store</p>
                                  <p className="text-white">{u.store_name ?? u.store_domain ?? '—'}</p>
                                  {u.whatsapp_bsp && <p className="text-slate-500 text-xs mt-0.5">BSP: {u.whatsapp_bsp}</p>}
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Automations</p>
                                  <p className="text-white">{u.active_automations} active</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Revenue</p>
                                  <p className="text-white">₹{PLAN_PRICES[u.billing_plan ?? ''] ?? 0}/mo</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE TAB ──────────────────────────────────────────────────── */}
        {tab === 'revenue' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="text-slate-400 text-sm font-medium mb-4">Revenue Breakdown</h3>
              <div className="space-y-3">
                {['starter', 'growth', 'pro'].map(plan => {
                  const count = users.filter(u => u.billing_plan === plan && u.billing_status === 'active').length
                  const rev   = count * (PLAN_PRICES[plan] ?? 0)
                  const pct   = stats.mrr_inr ? Math.round((rev / stats.mrr_inr) * 100) : 0
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between text-sm mb-1">
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
              <div className="mt-6 pt-4 border-t border-white/8">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">MRR</span>
                  <span className="text-white font-bold">₹{stats.mrr_inr.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">ARR</span>
                  <span className="text-white font-bold">₹{(stats.mrr_inr * 12).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <h3 className="text-slate-400 text-sm font-medium mb-4">Subscription Health</h3>
              <div className="space-y-4">
                {[
                  { label: 'Active',    count: users.filter(u => u.billing_status === 'active').length,    color: 'bg-green-500', icon: CheckCircle2, iconColor: 'text-green-400' },
                  { label: 'Trialing',  count: users.filter(u => u.billing_status === 'trialing').length,  color: 'bg-blue-500',  icon: Activity,    iconColor: 'text-blue-400'  },
                  { label: 'Cancelled', count: users.filter(u => u.billing_status === 'cancelled').length, color: 'bg-red-500',   icon: XCircle,     iconColor: 'text-red-400'   },
                  { label: 'Past Due',  count: users.filter(u => u.billing_status === 'past_due').length,  color: 'bg-amber-500', icon: AlertTriangle,iconColor: 'text-amber-400' },
                  { label: 'No plan',   count: users.filter(u => !u.billing_status).length,               color: 'bg-slate-500', icon: UserMinus,   iconColor: 'text-slate-400' },
                ].map(({ label, count, color, icon: Icon, iconColor }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', iconColor)} />
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
                  <span className="text-slate-400">Conversion rate</span>
                  <span className="text-white font-bold">
                    {stats.total_signups ? Math.round((stats.active_subscriptions / stats.total_signups) * 100) : 0}%
                  </span>
                </div>
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
                {actionType === 'plan' ? 'Change Plan' : 'Remove User'}
              </h3>
              <button onClick={() => { setActionUser(null); setActionType(null) }} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              {actionType === 'plan'
                ? <>Changing plan for <strong className="text-white">{actionUser.email}</strong></>
                : <>Permanently remove <strong className="text-white">{actionUser.email}</strong> and all their data?</>}
            </p>

            {actionType === 'plan' && (
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] mb-4">
                <option value="trial">Trial (free)</option>
                <option value="starter">Starter — ₹999/mo</option>
                <option value="growth">Growth — ₹2,999/mo</option>
                <option value="pro">Pro — ₹7,999/mo</option>
              </select>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setActionUser(null); setActionType(null) }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition">
                Cancel
              </button>
              <button
                onClick={actionType === 'plan' ? handleChangePlan : handleRemoveUser}
                disabled={actioning}
                className={cn('flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50',
                  actionType === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#25D366] hover:bg-[#128C7E]')}>
                {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {actionType === 'plan' ? 'Save' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

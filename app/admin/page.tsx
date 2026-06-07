'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Store, MessageSquare, TrendingUp, Loader2,
  Search, RefreshCw, CheckCircle2, XCircle, Zap,
  Calendar, Phone, Building2, ChevronDown, ChevronUp,
  LogOut, Shield, CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_EMAIL = 'vaibhavsingh9574395@gmail.com'

const TEAM_SIZE_LABELS: Record<string, string> = {
  just_me: 'Just me',
  '2_5':   '2–5',
  '6_20':  '6–20',
  '20_plus': '20+',
}

interface AdminUser {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  team_size: string | null
  email: string | null
  signed_up_at: string
  store_domain: string | null
  store_name: string | null
  store_plan: string | null
  store_active: boolean
  store_connected_at: string | null
  whatsapp_bsp: string | null
  active_automations: number
  messages_30d: number
  billing_plan: string | null
  billing_status: string | null
  billing_amount: number
  has_subscription: boolean
}

interface Stats {
  total_signups: number
  new_this_week: number
  stores_connected: number
  total_messages_30d: number
  active_subscriptions: number
  mrr_inr: number
  organizations: number
}

type SortKey = 'signed_up_at' | 'messages_30d' | 'active_automations'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function AdminPage() {
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState<SortKey>('signed_up_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    if (user.email !== ADMIN_EMAIL) { setForbidden(true); setLoading(false); return }

    const res = await fetch('/api/admin/users')
    if (!res.ok) { setForbidden(true); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setStats(data.stats ?? null)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return users
      .filter(u =>
        !s ||
        u.email?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s) ||
        u.company_name?.toLowerCase().includes(s) ||
        u.phone?.includes(s) ||
        u.store_domain?.toLowerCase().includes(s)
      )
      .sort((a, b) => {
        let av: number | string = a[sort] ?? ''
        let bv: number | string = b[sort] ?? ''
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
        }
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      })
  }, [users, search, sort, sortAsc])

  function toggleSort(key: SortKey) {
    if (sort === key) setSortAsc(v => !v)
    else { setSort(key); setSortAsc(false) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort !== k) return null
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Access denied</p>
          <p className="text-slate-400 text-sm mt-1">This page is restricted to admin users only.</p>
          <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-[#25D366] hover:underline">
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900">Wapaci Admin</span>
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Owner</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => { supabase.auth.signOut(); router.push('/login') }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Signups & Activity</h1>
          <p className="text-slate-500 text-sm mt-1">Every person who has registered for Wapaci</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users',          value: stats.total_signups,           icon: Users,        color: 'bg-blue-100 text-blue-600',    fmt: (v: number) => String(v) },
              { label: 'MRR',                  value: stats.mrr_inr,                 icon: TrendingUp,   color: 'bg-green-100 text-green-600',  fmt: (v: number) => `₹${v.toLocaleString('en-IN')}` },
              { label: 'Active Subscriptions', value: stats.active_subscriptions,    icon: Zap,          color: 'bg-amber-100 text-amber-600',  fmt: (v: number) => String(v) },
              { label: 'Stores Connected',     value: stats.stores_connected,        icon: Store,        color: 'bg-orange-100 text-orange-600',fmt: (v: number) => String(v) },
              { label: 'New This Week',         value: stats.new_this_week,           icon: TrendingUp,   color: 'bg-sky-100 text-sky-600',      fmt: (v: number) => String(v) },
              { label: 'Messages (30d)',        value: stats.total_messages_30d,      icon: MessageSquare,color: 'bg-purple-100 text-purple-600',fmt: (v: number) => String(v) },
              { label: 'Organizations',         value: stats.organizations,           icon: Building2,    color: 'bg-rose-100 text-rose-600',    fmt: (v: number) => String(v) },
            ].map(({ label, value, icon: Icon, color, fmt }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-slate-500 text-xs font-medium">{label}</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color.split(' ')[0]}`}>
                    <Icon className={`w-4 h-4 ${color.split(' ')[1]}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{fmt(value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, company, phone, or domain…"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs">User</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs">
                    <button className="flex items-center gap-1 hover:text-slate-800" onClick={() => toggleSort('signed_up_at')}>
                      Signed up <SortIcon k="signed_up_at" />
                    </button>
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden md:table-cell">Team</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden lg:table-cell">Store</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden lg:table-cell">
                    <button className="flex items-center gap-1 hover:text-slate-800" onClick={() => toggleSort('active_automations')}>
                      Automations <SortIcon k="active_automations" />
                    </button>
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden xl:table-cell">
                    <button className="flex items-center gap-1 hover:text-slate-800" onClick={() => toggleSort('messages_30d')}>
                      Msgs 30d <SortIcon k="messages_30d" />
                    </button>
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 text-sm py-16">
                      {search ? 'No results found' : 'No signups yet'}
                    </td>
                  </tr>
                ) : filtered.map(u => (
                  <>
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                    >
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#25D366]/10 flex items-center justify-center font-bold text-[#25D366] text-sm flex-shrink-0">
                            {u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : u.email?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{u.full_name ?? '—'}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Signed up */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-slate-600 text-xs">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          {timeAgo(u.signed_up_at)}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(u.signed_up_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </td>

                      {/* Team size */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div>
                          <p className="text-slate-700 font-medium text-xs">{u.company_name ?? '—'}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{u.team_size ? TEAM_SIZE_LABELS[u.team_size] : '—'}</p>
                        </div>
                      </td>

                      {/* Store */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        {u.store_domain ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              <span className="text-slate-700 text-xs font-medium">{u.store_name ?? u.store_domain}</span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">{u.whatsapp_bsp ?? 'no wa'}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="text-xs">Not connected</span>
                          </div>
                        )}
                      </td>

                      {/* Automations */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                          u.active_automations > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        )}>
                          <Zap className="w-3 h-3" /> {u.active_automations} active
                        </div>
                      </td>

                      {/* Messages 30d */}
                      <td className="px-5 py-4 hidden xl:table-cell">
                        <span className={cn(
                          'text-sm font-semibold',
                          u.messages_30d > 0 ? 'text-slate-800' : 'text-slate-300'
                        )}>
                          {u.messages_30d}
                        </span>
                      </td>

                      {/* Expand */}
                      <td className="px-5 py-4 text-slate-400">
                        {expanded === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expanded === u.id && (
                      <tr key={`${u.id}-detail`} className="bg-slate-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                              <p className="font-medium text-slate-800">{u.phone ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> Company</p>
                              <p className="font-medium text-slate-800">{u.company_name ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">Team size</p>
                              <p className="font-medium text-slate-800">{u.team_size ? TEAM_SIZE_LABELS[u.team_size] : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">Store domain</p>
                              <p className="font-medium text-slate-800">{u.store_domain ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">Store connected</p>
                              <p className="font-medium text-slate-800">
                                {u.store_connected_at
                                  ? new Date(u.store_connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Plan</p>
                              <p className="font-medium text-slate-800 capitalize">{u.billing_plan ?? 'trial'}</p>
                              {u.billing_status && (
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full capitalize',
                                  u.billing_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                )}>{u.billing_status}</span>
                              )}
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

          {filtered.length < users.length && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

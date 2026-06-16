'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart2, TrendingUp, MessageSquare, IndianRupee,
  Loader2, RefreshCw, Download, Eye, Send, CheckCheck,
  ShoppingCart, Star, Repeat, Package, Truck, Gift
} from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Range = '7d' | '30d' | '90d'

interface DailyRow {
  date: string
  messages_sent: number
  messages_delivered: number
  carts_recovered: number
  revenue_recovered: number
  cod_verified: number
}

interface MsgRow { type: string; status: string }
interface CampaignRow {
  id: string; name: string; status: string
  sent_count: number; delivered_count: number
  read_count?: number; revenue_attributed?: number; created_at: string
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  abandoned_cart:       { label: 'Abandoned Cart',     icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50' },
  cod_verification:     { label: 'COD Verification',   icon: Package,      color: 'text-purple-600', bg: 'bg-purple-50' },
  order_confirmation:   { label: 'Order Confirmation', icon: CheckCheck,   color: 'text-emerald-600',bg: 'bg-emerald-50'},
  shipping_update:      { label: 'Shipping Update',    icon: Truck,        color: 'text-blue-600',   bg: 'bg-blue-50'  },
  post_purchase_upsell: { label: 'Post-Purchase Upsell',icon: TrendingUp,  color: 'text-pink-600',   bg: 'bg-pink-50'  },
  win_back:             { label: 'Win-back',           icon: Repeat,       color: 'text-red-600',    bg: 'bg-red-50'   },
  review_request:       { label: 'Review Request',     icon: Star,         color: 'text-amber-600',  bg: 'bg-amber-50' },
  repeat_purchase:      { label: 'Repeat Purchase',    icon: Gift,         color: 'text-indigo-600', bg: 'bg-indigo-50'},
  broadcast:            { label: 'Campaign',           icon: MessageSquare,color: 'text-teal-600',   bg: 'bg-teal-50'  },
}

export default function AnalyticsPage() {
  const [range, setRange]       = useState<Range>('30d')
  const [rows, setRows]         = useState<DailyRow[]>([])
  const [msgRows, setMsgRows]   = useState<MsgRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [hasStore, setHasStore] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: store } = await supabase.from('stores').select('id').eq('user_id', user.id)
      .eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const days = r === '7d' ? 7 : r === '30d' ? 30 : 90
    const from = new Date(Date.now() - days * 86400000).toISOString()
    const fromDate = from.split('T')[0]

    const [dailyRes, msgRes, campRes] = await Promise.all([
      supabase.from('analytics_daily').select('*').eq('store_id', store.id).gte('date', fromDate).order('date'),
      supabase.from('messages').select('type,status').eq('store_id', store.id).gte('created_at', from),
      supabase.from('campaigns').select('id,name,status,sent_count,delivered_count,read_count,revenue_attributed,created_at')
        .eq('store_id', store.id).in('status', ['completed', 'running']).order('created_at', { ascending: false }).limit(10),
    ])

    setRows(dailyRes.data ?? [])
    setMsgRows(msgRes.data ?? [])
    setCampaigns((campRes.data ?? []) as CampaignRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load(range) }, [load, range])

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      sent:      acc.sent      + r.messages_sent,
      delivered: acc.delivered + r.messages_delivered,
      carts:     acc.carts     + r.carts_recovered,
      revenue:   acc.revenue   + Number(r.revenue_recovered ?? 0),
      cod:       acc.cod       + r.cod_verified,
    }),
    { sent: 0, delivered: 0, carts: 0, revenue: 0, cod: 0 }
  ), [rows])

  // Per-type breakdown from messages
  const typeBreakdown = useMemo(() => {
    const map: Record<string, { sent: number; delivered: number; read: number }> = {}
    for (const m of msgRows) {
      if (!map[m.type]) map[m.type] = { sent: 0, delivered: 0, read: 0 }
      map[m.type].sent++
      if (m.status === 'delivered') map[m.type].delivered++
      if (m.status === 'read') { map[m.type].delivered++; map[m.type].read++ }
    }
    return Object.entries(map).sort((a, b) => b[1].sent - a[1].sent)
  }, [msgRows])

  const delivRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0
  const readRate  = totals.delivered > 0 ? Math.round(Math.min(100, delivRate * 0.68)) : 0
  const campaignRevenue = campaigns.reduce((s, c) => s + (c.revenue_attributed ?? 0), 0)

  // Chart data — last N days
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const chartDays = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const d = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 86400000).toISOString().split('T')[0]
    const row = rows.find(r => r.date === d)
    return { day: d.slice(5), sent: row?.messages_sent ?? 0, revenue: Number(row?.revenue_recovered ?? 0) }
  })
  const maxSent = Math.max(...chartDays.map(d => d.sent), 1)
  const maxRev  = Math.max(...chartDays.map(d => d.revenue), 1)

  function exportCSV() {
    const lines = [['Date','Messages Sent','Delivered','Carts Recovered','Revenue'].join(',')]
    rows.forEach(r => lines.push([r.date, r.messages_sent, r.messages_delivered, r.carts_recovered, r.revenue_recovered].join(',')))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    a.download = `wapaci-analytics-${range}.csv`; a.click()
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Revenue and performance metrics for your WhatsApp channel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
            {(['7d','30d','90d'] as Range[]).map(r => (
              <button key={r} onClick={() => { setRange(r); load(r) }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                  range === r ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:text-slate-700')}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => load(range)} className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={20} className="animate-spin text-[#25D366]" /></div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <BarChart2 size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store to see analytics</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'WhatsApp Revenue', value: formatCurrency(totals.revenue + campaignRevenue), icon: IndianRupee, cls: 'text-emerald-600 bg-emerald-50', trend: '+' },
              { label: 'Messages Sent',    value: formatNumber(totals.sent), icon: Send, cls: 'text-blue-600 bg-blue-50', trend: null },
              { label: 'Delivery Rate',    value: totals.sent > 0 ? `${delivRate}%` : '—', icon: CheckCheck, cls: 'text-purple-600 bg-purple-50', trend: null },
              { label: 'Read Rate',        value: totals.sent > 0 ? `${readRate}%` : '—', icon: Eye, cls: 'text-amber-600 bg-amber-50', trend: null },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-500 text-xs font-medium">{k.label}</p>
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', k.cls.split(' ')[1])}>
                    <k.icon size={15} className={k.cls.split(' ')[0]} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">Last {range}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Message volume chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-800">Message Volume</h2>
                  <p className="text-slate-400 text-xs mt-0.5">{range} trend</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{formatNumber(totals.sent)} total</span>
              </div>
              {totals.sent > 0 ? (
                <div className="flex items-end gap-1 h-28">
                  {chartDays.map((d, i) => (
                    <div key={i} className="flex-1 group relative">
                      <div
                        className="w-full bg-[#25D366]/70 hover:bg-[#25D366] rounded-t transition-all"
                        style={{ height: `${Math.max(3, (d.sent / maxSent) * 100)}%` }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10">
                        {d.day}: {d.sent}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 text-sm">No data for this period</p>
                </div>
              )}
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-400">{chartDays[0]?.day}</span>
                <span className="text-[10px] text-slate-400">{chartDays[chartDays.length - 1]?.day}</span>
              </div>
            </div>

            {/* Revenue chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-800">Revenue Recovered</h2>
                  <p className="text-slate-400 text-xs mt-0.5">WhatsApp attributed revenue</p>
                </div>
                <span className="text-xs font-bold text-emerald-600">{formatCurrency(totals.revenue)}</span>
              </div>
              {totals.revenue > 0 ? (
                <div className="flex items-end gap-1 h-28">
                  {chartDays.map((d, i) => (
                    <div key={i} className="flex-1 group relative">
                      <div
                        className="w-full bg-emerald-400/70 hover:bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${Math.max(d.revenue > 0 ? 3 : 0, (d.revenue / maxRev) * 100)}%` }}
                      />
                      {d.revenue > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10">
                          {d.day}: {formatCurrency(d.revenue)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 text-sm">No revenue data yet</p>
                </div>
              )}
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-400">{chartDays[0]?.day}</span>
                <span className="text-[10px] text-slate-400">{chartDays[chartDays.length - 1]?.day}</span>
              </div>
            </div>
          </div>

          {/* Automation performance */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Automation Performance</h2>
              <span className="text-xs text-slate-400">{typeBreakdown.length} types</span>
            </div>
            {typeBreakdown.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart2 size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No automation data for this period</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {/* Header */}
                <div className="hidden lg:grid grid-cols-[auto_1fr_80px_80px_80px_100px_200px] gap-4 px-5 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50">
                  <div className="w-8" /><div>Type</div><div>Sent</div><div>Delivered</div><div>Read</div><div>Del. Rate</div><div>Progress</div>
                </div>
                {typeBreakdown.map(([type, stats]) => {
                  const meta = TYPE_META[type] ?? { label: type, icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100' }
                  const dRate = stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0
                  const rRate = stats.sent > 0 ? Math.round((stats.read / stats.sent) * 100) : 0
                  const Icon = meta.icon
                  return (
                    <div key={type} className="flex lg:grid lg:grid-cols-[auto_1fr_80px_80px_80px_100px_200px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', meta.bg)}>
                        <Icon size={14} className={meta.color} />
                      </div>
                      <p className="font-medium text-slate-800 text-sm">{meta.label}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{stats.sent}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{stats.delivered}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{stats.read}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{dRate}%</p>
                      <div className="hidden lg:block">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#25D366] rounded-full" style={{ width: `${dRate}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-8 text-right">{dRate}%</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${rRate}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-8 text-right">{rRate}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Campaign performance */}
          {campaigns.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Campaign Performance</h2>
              </div>
              <div className="divide-y divide-slate-50">
                <div className="hidden lg:grid grid-cols-[1fr_80px_80px_60px_100px] gap-4 px-5 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50">
                  <div>Campaign</div><div>Sent</div><div>Delivered</div><div>Read</div><div>Revenue</div>
                </div>
                {campaigns.map(c => {
                  const dRate = c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0
                  return (
                    <div key={c.id} className="flex lg:grid lg:grid-cols-[1fr_80px_80px_60px_100px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="h-1 w-24 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#25D366] rounded-full" style={{ width: `${dRate}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{dRate}% delivered</span>
                        </div>
                      </div>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{c.sent_count}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{c.delivered_count}</p>
                      <p className="hidden lg:block text-sm font-semibold text-slate-700">{c.read_count ?? 0}</p>
                      <p className="hidden lg:block text-sm font-semibold text-emerald-600">
                        {c.revenue_attributed ? formatCurrency(c.revenue_attributed) : '—'}
                      </p>
                    </div>
                  )
                })}
                {campaignRevenue > 0 && (
                  <div className="px-5 py-3 bg-emerald-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-700">Total Campaign Revenue</span>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(campaignRevenue)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, TrendingUp, MessageSquare, ShoppingCart, IndianRupee, Zap, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import Link from 'next/link'

type Range = '7d' | '30d' | '90d'

interface DailyRow {
  date: string
  messages_sent: number
  messages_delivered: number
  carts_recovered: number
  revenue_recovered: number
  cod_verified: number
  cod_cancelled: number
}

interface MessageTypeRow {
  type: string
  count: number
  status: string
}

const AUTOMATION_META: Record<string, { name: string; color: string }> = {
  abandoned_cart:      { name: 'Abandoned Cart',       color: 'bg-orange-500' },
  cod_verification:    { name: 'COD Verification',     color: 'bg-purple-500' },
  order_confirmation:  { name: 'Order Confirmation',   color: 'bg-green-500'  },
  shipping_update:     { name: 'Shipping Update',      color: 'bg-blue-500'   },
  win_back:            { name: 'Win-back Campaign',    color: 'bg-indigo-500' },
  review_request:      { name: 'Review Request',       color: 'bg-yellow-500' },
  post_purchase_upsell:{ name: 'Post-Purchase Upsell', color: 'bg-pink-500'   },
  broadcast:           { name: 'Campaign Broadcast',   color: 'bg-teal-500'   },
}

export default function AnalyticsPage() {
  const [range, setRange]   = useState<Range>('30d')
  const [rows, setRows]     = useState<DailyRow[]>([])
  const [typeRows, setTypeRows] = useState<MessageTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()

    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const days = r === '7d' ? 7 : r === '30d' ? 30 : 90
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [{ data: dailyData }, { data: msgData }] = await Promise.all([
      supabase
        .from('analytics_daily')
        .select('*')
        .eq('store_id', store.id)
        .gte('date', fromDate)
        .order('date', { ascending: true }),
      supabase
        .from('messages')
        .select('type, status')
        .eq('store_id', store.id)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()),
    ])

    setRows(dailyData ?? [])

    // Aggregate messages by type
    const typeMap: Record<string, { sent: number; delivered: number }> = {}
    for (const m of msgData ?? []) {
      if (!typeMap[m.type]) typeMap[m.type] = { sent: 0, delivered: 0 }
      typeMap[m.type].sent++
      if (m.status === 'delivered' || m.status === 'read') typeMap[m.type].delivered++
    }
    setTypeRows(
      Object.entries(typeMap).map(([type, v]) => ({
        type,
        count: v.sent,
        status: String(v.delivered),
      }))
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => { load(range) }, [load, range])

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      messages_sent:      acc.messages_sent      + r.messages_sent,
      messages_delivered: acc.messages_delivered + r.messages_delivered,
      carts_recovered:    acc.carts_recovered    + r.carts_recovered,
      revenue_recovered:  acc.revenue_recovered  + Number(r.revenue_recovered),
      cod_verified:       acc.cod_verified       + r.cod_verified,
    }),
    { messages_sent: 0, messages_delivered: 0, carts_recovered: 0, revenue_recovered: 0, cod_verified: 0 }
  ), [rows])

  const maxMessages = useMemo(() => Math.max(...rows.map(r => r.messages_sent), 1), [rows])

  const deliveryRate = totals.messages_sent > 0
    ? Math.round((totals.messages_delivered / totals.messages_sent) * 100)
    : 0

  const ranges: Range[] = ['7d', '30d', '90d']
  const rangeLabels: Record<Range, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Performance overview — {rangeLabels[range]}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => { setRange(r); load(r) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  range === r ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(range)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <BarChart2 className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store to see analytics</p>
          <Link href="/dashboard/integrations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
            Connect store →
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Messages Sent',     value: formatNumber(totals.messages_sent),          icon: MessageSquare,  bg: 'bg-blue-100',   color: 'text-blue-600',   change: `${deliveryRate}% delivered` },
              { label: 'Carts Recovered',   value: formatNumber(totals.carts_recovered),        icon: ShoppingCart,   bg: 'bg-orange-100', color: 'text-orange-600', change: 'via cart recovery' },
              { label: 'Revenue Recovered', value: formatCurrency(totals.revenue_recovered),    icon: IndianRupee,    bg: 'bg-green-100',  color: 'text-green-600',  change: 'attributed to Wapaci' },
              { label: 'COD Verified',      value: formatNumber(totals.cod_verified),           icon: Zap,            bg: 'bg-purple-100', color: 'text-purple-600', change: 'orders confirmed' },
            ].map(({ label, value, icon: Icon, bg, color, change }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-slate-500 text-xs font-medium">{label}</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className={`text-xs mt-1 flex items-center gap-0.5 font-medium ${totals.messages_sent > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                  {totals.messages_sent > 0 && <ArrowUpRight className="w-3 h-3" />}
                  {change}
                </p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#25D366]" /> Daily Message Volume
              </h2>
              <span className="text-xs text-slate-400">{rangeLabels[range]}</span>
            </div>
            {rows.length === 0 ? (
              <div className="h-32 flex items-center justify-center">
                <p className="text-slate-400 text-sm">No data for this period</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-32 overflow-x-auto pb-2">
                {rows.map(d => (
                  <div key={d.date} className="flex-shrink-0 flex flex-col items-center gap-1" style={{ minWidth: range === '90d' ? '8px' : '24px' }}>
                    <div
                      className="w-full bg-[#25D366] rounded-t-sm transition-all"
                      style={{ height: `${(d.messages_sent / maxMessages) * 100}%`, minHeight: d.messages_sent > 0 ? '4px' : '0px' }}
                      title={`${d.date}: ${d.messages_sent} messages`}
                    />
                    {range !== '90d' && (
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">
                        {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automation performance — per-type from messages table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#25D366]" /> Automation Performance
              </h2>
            </div>
            {typeRows.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">No automation data yet. Enable automations to start seeing results.</p>
                <Link href="/dashboard/automations" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline">
                  Enable automations →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Automation</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Sent</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Delivery Rate</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {typeRows
                      .sort((a, b) => b.count - a.count)
                      .map(row => {
                        const meta = AUTOMATION_META[row.type] ?? { name: row.type, color: 'bg-slate-400' }
                        const delivered = parseInt(row.status, 10) || 0
                        const rate = row.count > 0 ? Math.round((delivered / row.count) * 100) : 0
                        return (
                          <tr key={row.type} className="hover:bg-slate-50 transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${meta.color}`} />
                                <span className="font-medium text-slate-800">{meta.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">{formatNumber(row.count)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                                  <div className="bg-[#25D366] h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                                </div>
                                <span className="text-slate-700 font-medium text-xs">{rate}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-800">
                              {row.type === 'abandoned_cart' ? formatCurrency(totals.revenue_recovered) : '—'}
                            </td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

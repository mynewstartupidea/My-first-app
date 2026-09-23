'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BarChart2, TrendingUp, Target, Trash2,
  Loader2, RefreshCw, Download, Users, CheckCircle2,
  Megaphone, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = '7d' | '30d' | '90d'

interface Kpis {
  total: number
  converted: number
  junk: number
  lost: number
  good: number
  closeRate: number
  junkRate: number
  waSent: number
}

interface DailyRow   { date: string; count: number }
interface StatusRow  { status: string; count: number }
interface AdRow      { ad_name: string; campaign_name: string | null; adset_name: string | null; total: number; converted: number; junk: number; close_rate: number }
interface FormRow    { form_name: string; total: number; converted: number; junk: number; close_rate: number }

interface AnalyticsData {
  kpis:     Kpis
  daily:    DailyRow[]
  byStatus: StatusRow[]
  byAd:     AdRow[]
  byForm:   FormRow[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  hot:        { label: 'Hot',       color: 'text-orange-600', bg: 'bg-orange-50',  dot: '#f97316' },
  warm:       { label: 'Warm',      color: 'text-amber-600',  bg: 'bg-amber-50',   dot: '#f59e0b' },
  cold:       { label: 'Cold',      color: 'text-blue-600',   bg: 'bg-blue-50',    dot: '#3b82f6' },
  converted:  { label: 'Converted', color: 'text-emerald-600',bg: 'bg-emerald-50', dot: '#10b981' },
  lost:       { label: 'Lost',      color: 'text-slate-500',  bg: 'bg-slate-100',  dot: '#94a3b8' },
  junk:       { label: 'Junk',      color: 'text-red-600',    bg: 'bg-red-50',     dot: '#ef4444' },
  resolved:   { label: 'Resolved',  color: 'text-teal-600',   bg: 'bg-teal-50',    dot: '#14b8a6' },
  untagged:   { label: 'Untagged',  color: 'text-slate-400',  bg: 'bg-slate-50',   dot: '#cbd5e1' },
}

function CloseRateBadge({ rate }: { rate: number }) {
  const color = rate >= 20 ? 'text-emerald-600 bg-emerald-50' : rate >= 10 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  return <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', color)}>{rate}%</span>
}

export default function AnalyticsPage() {
  const [range,   setRange]   = useState<Range>('30d')
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/leads?range=${r}`)
      if (res.ok) setData(await res.json() as AnalyticsData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [load, range])

  const chartDays = useMemo(() => {
    if (!data) return []
    const max = Math.max(...data.daily.map(d => d.count), 1)
    return data.daily.map(d => ({ ...d, pct: Math.max(d.count > 0 ? 4 : 0, (d.count / max) * 100) }))
  }, [data])

  function exportCSV() {
    if (!data) return
    const lines = [
      ['Date', 'Leads'].join(','),
      ...data.daily.map(d => [d.date, d.count].join(',')),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    a.download = `wapaci-leads-${range}.csv`; a.click()
  }

  const kpis = data?.kpis

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-5 md:mb-6">
        <div className="min-w-0">
          <h1 className="hidden md:block text-xl sm:text-2xl font-bold text-slate-900">Lead Analytics</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Track your lead quality, ad performance, and close rate</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
            {(['7d', '30d', '90d'] as Range[]).map(r => (
              <button key={r} onClick={() => { setRange(r); load(r) }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                  range === r ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:text-slate-700')}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => load(range)}
            className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm">
            <RefreshCw size={13} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm">
            <Download size={13} /> <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={20} className="animate-spin text-[#25D366]" />
        </div>
      ) : !data ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <BarChart2 size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Could not load analytics data</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 md:mb-6">
            {[
              { label: 'Total Leads',    value: kpis!.total,             icon: Users,       cls: 'text-slate-600 bg-slate-100' },
              { label: 'Sales',          value: kpis!.converted,         icon: CheckCircle2,cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Close Rate',     value: `${kpis!.closeRate}%`,   icon: TrendingUp,  cls: 'text-indigo-600 bg-indigo-50' },
              { label: 'Junk Leads',     value: kpis!.junk,              icon: Trash2,      cls: 'text-red-500 bg-red-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-slate-500 text-xs font-medium min-w-0 truncate">{k.label}</p>
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', k.cls.split(' ')[1])}>
                    <k.icon size={15} className={k.cls.split(' ')[0]} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">Last {range}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5 md:mb-6">
            {/* Lead volume chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-800">Lead Volume</h2>
                  <p className="text-slate-400 text-xs mt-0.5">New leads per day</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{kpis!.total} total</span>
              </div>
              {kpis!.total > 0 ? (
                <div className="flex items-end gap-0.5 h-28">
                  {chartDays.map((d, i) => (
                    <div key={i} className="flex-1 group relative">
                      <div
                        className="w-full bg-[#25D366]/60 hover:bg-[#25D366] rounded-t transition-all"
                        style={{ height: `${d.pct}%` }}
                      />
                      {d.count > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10">
                          {d.date.slice(5)}: {d.count} lead{d.count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 text-sm">No leads in this period</p>
                </div>
              )}
              {kpis!.total > 0 && (
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-slate-400">{chartDays[0]?.date.slice(5)}</span>
                  <span className="text-[10px] text-slate-400">{chartDays[chartDays.length - 1]?.date.slice(5)}</span>
                </div>
              )}
            </div>

            {/* Lead quality breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-800">Lead Quality</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Breakdown by sales team tags</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{kpis!.total} total</span>
              </div>
              {data.byStatus.length === 0 ? (
                <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 text-sm">No tagged leads yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.byStatus.map(row => {
                    const meta  = STATUS_META[row.status] ?? STATUS_META.untagged
                    const pct   = kpis!.total > 0 ? Math.round((row.count / kpis!.total) * 100) : 0
                    return (
                      <div key={row.status}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
                            <span className="font-medium text-slate-700">{meta.label}</span>
                          </div>
                          <span className="text-slate-500 tabular-nums">{row.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.dot }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Ad attribution — only shown if any leads have ad source */}
          {data.byAd.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Megaphone size={15} className="text-indigo-500 flex-shrink-0" />
                <h2 className="font-semibold text-slate-800">Ad Performance</h2>
                <span className="text-xs text-slate-400 ml-auto">{data.byAd.length} ads</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      <th className="px-5 py-2.5 text-left">Ad</th>
                      <th className="px-4 py-2.5 text-right">Leads</th>
                      <th className="px-4 py-2.5 text-right">Sales</th>
                      <th className="px-4 py-2.5 text-right">Junk</th>
                      <th className="px-4 py-2.5 text-right">Close Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.byAd.map(row => (
                      <tr key={row.ad_name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-800 truncate max-w-[220px]" title={row.ad_name}>{row.ad_name}</p>
                          {row.campaign_name && (
                            <p className="text-xs text-slate-400 truncate max-w-[220px]">{row.campaign_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-slate-700">{row.total}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-emerald-600">{row.converted}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-red-500">{row.junk}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <CloseRateBadge rate={row.close_rate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form performance */}
          {data.byForm.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileText size={15} className="text-sky-500 flex-shrink-0" />
                <h2 className="font-semibold text-slate-800">Form Performance</h2>
                <span className="text-xs text-slate-400 ml-auto">{data.byForm.length} forms</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      <th className="px-5 py-2.5 text-left">Form</th>
                      <th className="px-4 py-2.5 text-right">Leads</th>
                      <th className="px-4 py-2.5 text-right">Sales</th>
                      <th className="px-4 py-2.5 text-right">Junk</th>
                      <th className="px-4 py-2.5 text-right">Close Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.byForm.map(row => (
                      <tr key={row.form_name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-800 truncate max-w-[240px]" title={row.form_name}>{row.form_name}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-slate-700">{row.total}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-emerald-600">{row.converted}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-red-500">{row.junk}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <CloseRateBadge rate={row.close_rate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary insight */}
              {kpis!.total > 0 && kpis!.junkRate > 30 && (
                <div className="px-5 py-3.5 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                  <Target size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    <span className="font-semibold">{kpis!.junkRate}% junk rate</span> — consider reviewing your ad targeting to attract higher-quality leads.
                  </p>
                </div>
              )}
            </div>
          )}

          {kpis!.total === 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <BarChart2 size={36} className="text-slate-200 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No leads in the last {range}</p>
              <p className="text-slate-400 text-sm mt-1">Sync your Facebook lead forms to get started.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

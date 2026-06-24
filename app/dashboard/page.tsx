export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  IndianRupee, MessageSquare, ShoppingCart, TrendingUp,
  ArrowRight, Zap, Store, AlertCircle, CheckCircle2,
  Send, Eye, MousePointerClick, RefreshCw, Users, Target
} from 'lucide-react'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils'
import Link from 'next/link'
import WhatsAppStatusBanner from '@/components/whatsapp-status-banner'
import { pickPreferredStore } from '@/lib/store-selection'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: storeRows } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  let store = pickPreferredStore(storeRows)

  if (!store) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('company_name').eq('id', user.id).maybeSingle()
      const shopName = profile?.company_name || (user.user_metadata?.company_name as string | undefined) || 'My Store'
      const { data: newStore } = await supabase
        .from('stores')
        .insert({ user_id: user.id, shop_name: shopName, is_active: true, whatsapp_bsp: 'mock', plan: 'starter' })
        .select('*').single()
      if (newStore) {
        store = newStore
        await supabase.rpc('create_default_automations', { p_store_id: newStore.id })
      }
    } catch { /* non-fatal */ }
  }

  // WhatsApp connection status
  const { data: waAccount } = await supabase
    .from('whatsapp_accounts')
    .select('display_phone_number, token_type, status')
    .eq('user_id', user.id)
    .eq('status', 'connected')
    .maybeSingle()

  const waConnected = !!waAccount
  const waPhone     = waAccount?.display_phone_number ?? store?.whatsapp_number ?? null
  // Also consider store.whatsapp_bsp as a fallback for older records
  const waFallback  = !waConnected && store?.whatsapp_bsp === 'meta' && !!store?.whatsapp_number

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [analyticsRes, messagesRes, campaignsRes, customersRes, automationsRes] = await Promise.all([
    store ? supabase.from('analytics_daily').select('*').eq('store_id', store.id).gte('date', thirtyDaysAgo).order('date') : Promise.resolve({ data: [] }),
    store ? supabase.from('messages').select('id,type,status,revenue_attributed,created_at,customer_name,customer_phone,message').eq('store_id', store.id).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    store ? supabase.from('campaigns').select('id,name,status,sent_count,delivered_count,read_count,revenue_attributed,created_at').eq('store_id', store.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    store ? supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('whatsapp_opt_in', true) : Promise.resolve({ count: 0 }),
    store ? supabase.from('automations').select('type,is_enabled').eq('store_id', store.id) : Promise.resolve({ data: [] }),
  ])

  const analytics = analyticsRes.data ?? []
  const recentMessages = messagesRes.data ?? []
  const recentCampaigns = (campaignsRes.data ?? []) as Array<{
    id: string; name: string; status: string; sent_count: number;
    delivered_count: number; read_count?: number; revenue_attributed?: number; created_at: string
  }>
  const optInCount = customersRes.count ?? 0
  const automations = automationsRes.data ?? []
  const activeAutomations = automations.filter(a => a.is_enabled).length

  const totals = analytics.reduce(
    (acc, row) => ({
      revenue:   acc.revenue   + Number(row.revenue_recovered ?? 0),
      sent:      acc.sent      + (row.messages_sent ?? 0),
      delivered: acc.delivered + (row.messages_delivered ?? 0),
      carts:     acc.carts     + (row.carts_recovered ?? 0),
      cod:       acc.cod       + (row.cod_verified ?? 0),
    }),
    { revenue: 0, sent: 0, delivered: 0, carts: 0, cod: 0 }
  )

  // Revenue from messages table (attributed)
  const attributedRevenue = recentMessages.reduce((sum, m) => sum + Number(m.revenue_attributed ?? 0), 0)
  const totalRevenue = Math.max(totals.revenue, attributedRevenue)

  // Build 14-day sparkline data
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0]
    const row = analytics.find(r => r.date === d)
    return { day: d.slice(5), val: row?.messages_sent ?? 0, rev: Number(row?.revenue_recovered ?? 0) }
  })
  const maxVal = Math.max(...last14.map(d => d.val), 1)

  const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0
  const readRate = deliveryRate > 0 ? Math.round(deliveryRate * 0.65) : 0

  const typeLabels: Record<string, string> = {
    abandoned_cart: 'Cart Recovery', cod_verification: 'COD Verify',
    order_confirmation: 'Order', shipping_update: 'Shipping',
    post_purchase_upsell: 'Upsell', win_back: 'Win-back',
    review_request: 'Review', broadcast: 'Campaign',
  }

  const statusColors: Record<string, string> = {
    sent: 'text-blue-600 bg-blue-50', delivered: 'text-green-600 bg-green-50',
    read: 'text-emerald-600 bg-emerald-50', failed: 'text-red-600 bg-red-50',
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="p-6 lg:p-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-slate-400 text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            {store?.shop_name ?? 'Your Store'} Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/automations"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm">
            <Zap size={14} className="text-[#25D366]" /> Automations
          </Link>
          <Link href="/dashboard/campaigns"
            className="flex items-center gap-1.5 text-sm font-medium bg-[#25D366] text-white px-3 py-2 rounded-xl hover:bg-[#1aad54] transition shadow-sm">
            <Send size={14} /> New Campaign
          </Link>
        </div>
      </div>

      {/* No store banner */}
      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-7 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Connect your Shopify store to unlock revenue automation</p>
            <p className="text-amber-600 text-sm mt-0.5">Once connected, automations will start recovering abandoned carts and generating revenue 24/7.</p>
            <Link href="/dashboard/shopify" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-amber-700 hover:text-amber-900">
              <Store size={14} /> Connect Shopify <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* WhatsApp connection banner */}
      <WhatsAppStatusBanner
        connected={waConnected || waFallback}
        phone={waPhone}
        tokenType={waAccount?.token_type ?? null}
      />

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'WhatsApp Revenue', value: formatCurrency(totalRevenue),
            icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50',
            sub: `${totals.carts} carts recovered`,
            trend: totalRevenue > 0,
          },
          {
            label: 'Messages Sent', value: formatNumber(totals.sent),
            icon: Send, color: 'text-blue-600', bg: 'bg-blue-50',
            sub: `${deliveryRate}% delivery rate`,
            trend: totals.sent > 0,
          },
          {
            label: 'Read Rate', value: totals.sent > 0 ? `${readRate}%` : '—',
            icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50',
            sub: 'vs 20% email avg',
            trend: readRate > 50,
          },
          {
            label: 'Opt-in Contacts', value: formatNumber(optInCount),
            icon: Users, color: 'text-orange-600', bg: 'bg-orange-50',
            sub: `${activeAutomations} automations active`,
            trend: optInCount > 0,
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-xs font-medium">{card.label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.bg}`}>
                <card.icon size={15} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{card.value}</p>
            <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
              {card.trend && <TrendingUp size={11} className="text-emerald-500" />}
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

        {/* Message volume sparkline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-800">Message Volume</h2>
              <p className="text-slate-400 text-xs mt-0.5">Last 14 days</p>
            </div>
            <span className="text-xs font-medium text-slate-400">{formatNumber(totals.sent)} total</span>
          </div>
          {totals.sent > 0 ? (
            <div className="flex items-end gap-1 h-24">
              {last14.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-[#25D366]/80 rounded-sm hover:bg-[#25D366] transition-all"
                    style={{ height: `${Math.max(4, (d.val / maxVal) * 100)}%` }}
                    title={`${d.day}: ${d.val} msgs`}
                  />
                  {i % 3 === 0 && <span className="text-[9px] text-slate-300">{d.day}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
              <div className="text-center">
                <p className="text-slate-400 text-sm">No messages yet</p>
                <Link href="/dashboard/automations" className="text-[#25D366] text-xs font-medium hover:underline mt-1 inline-block">
                  Enable automations →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Performance</h2>
          <div className="space-y-3.5">
            {[
              { label: 'Delivery Rate', value: totals.sent > 0 ? `${deliveryRate}%` : '—', color: 'bg-blue-500', pct: deliveryRate },
              { label: 'Read Rate',     value: totals.sent > 0 ? `${readRate}%` : '—',     color: 'bg-purple-500', pct: readRate },
              { label: 'Cart Recovery', value: totals.carts > 0 ? `${totals.carts}` : '—', color: 'bg-emerald-500', pct: totals.carts > 0 ? 75 : 0 },
              { label: 'COD Verified',  value: totals.cod > 0 ? `${totals.cod}` : '—',     color: 'bg-orange-400', pct: totals.cod > 0 ? 60 : 0 },
            ].map(stat => (
              <div key={stat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 text-xs">{stat.label}</span>
                  <span className="text-slate-800 text-xs font-semibold">{stat.value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.color} rounded-full transition-all`} style={{ width: `${stat.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Target size={12} className="text-[#25D366]" /> Revenue Goal
            </div>
            <p className="text-slate-800 font-semibold text-sm">{formatCurrency(totalRevenue)} <span className="text-slate-400 font-normal">/ ₹1,00,000</span></p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full" style={{ width: `${Math.min(100, (totalRevenue / 100000) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: recent messages + campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Messages</h2>
            <Link href="/dashboard/live-chat" className="text-[#25D366] text-xs font-medium flex items-center gap-1 hover:underline">
              Live Chat <ArrowRight size={12} />
            </Link>
          </div>

          {recentMessages.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {recentMessages.map((msg: { id: string; customer_name?: string; customer_phone: string; message: string; type: string; status: string; created_at: string }) => (
                <div key={msg.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 text-[#25D366] text-xs font-bold">
                    {(msg.customer_name ?? msg.customer_phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{msg.customer_name ?? msg.customer_phone}</p>
                    <p className="text-xs text-slate-400 truncate">{msg.message.slice(0, 55)}…</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      {typeLabels[msg.type] ?? msg.type}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${statusColors[msg.status] ?? 'text-slate-500 bg-slate-100'}`}>
                        {msg.status}
                      </span>
                      <span className="text-[10px] text-slate-300">{timeAgo(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center px-6">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare size={22} className="text-slate-300" />
              </div>
              <p className="font-medium text-slate-600 text-sm">No messages yet</p>
              <p className="text-slate-400 text-xs mt-1">Enable automations to start sending WhatsApp messages</p>
              <Link href="/dashboard/automations" className="mt-3 inline-flex items-center gap-1 text-sm text-[#25D366] font-medium hover:underline">
                Set up automations <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Automation status */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Automations</h3>
              <Link href="/dashboard/automations" className="text-[#25D366] text-xs font-medium hover:underline">Manage</Link>
            </div>
            <div className="space-y-2.5">
              {automations.length > 0 ? automations.slice(0, 5).map((auto: { type: string; is_enabled: boolean }) => (
                <div key={auto.type} className="flex items-center justify-between">
                  <span className="text-slate-600 text-xs">{typeLabels[auto.type] ?? auto.type}</span>
                  <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${auto.is_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {auto.is_enabled
                      ? <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> On</>
                      : 'Off'}
                  </span>
                </div>
              )) : (
                <p className="text-slate-400 text-xs">No automations configured</p>
              )}
            </div>
          </div>

          {/* Top campaigns */}
          {recentCampaigns.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Recent Campaigns</h3>
                <Link href="/dashboard/campaigns" className="text-[#25D366] text-xs font-medium hover:underline">All</Link>
              </div>
              <div className="space-y-3">
                {recentCampaigns.map(c => (
                  <div key={c.id} className="text-xs">
                    <p className="font-medium text-slate-700 truncate">{c.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-slate-400">
                      <span className="flex items-center gap-0.5"><Send size={10} /> {c.sent_count}</span>
                      <span className="flex items-center gap-0.5"><CheckCircle2 size={10} /> {c.delivered_count}</span>
                      {c.revenue_attributed && c.revenue_attributed > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-600 font-medium"><IndianRupee size={10} /> {formatCurrency(c.revenue_attributed)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA card */}
          <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-5 text-white">
            <MousePointerClick size={18} className="mb-2 opacity-80" />
            <p className="font-semibold text-sm">Recover more revenue</p>
            <p className="text-green-100 text-xs mt-1 leading-relaxed">Abandoned cart automation recovers 15-25% of lost orders on average.</p>
            <Link href="/dashboard/automations" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
              Enable now <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

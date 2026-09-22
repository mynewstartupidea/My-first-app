export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  IndianRupee, MessageSquare, TrendingUp,
  ArrowRight, Zap, AlertCircle, CheckCircle2,
  Send, Eye, MousePointerClick, Users, Target,
  Phone, Calendar,
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

  // Billing usage for low-credit banner
  const { data: billing } = await supabase
    .from('billing')
    .select('messages_limit, messages_used')
    .eq('user_id', user.id)
    .maybeSingle()

  const msgLimit = billing?.messages_limit ?? 500
  const msgUsed  = billing?.messages_used  ?? 0
  const msgPct   = msgLimit >= 999_999_999 ? 0 : Math.min(100, Math.round((msgUsed / msgLimit) * 100))
  const msgLeft  = Math.max(0, msgLimit - msgUsed)

  const service = createServiceClient()

  // Lead-based dashboard metrics need to match what the Leads page shows by default:
  // it defaults to the earliest-connected Facebook Page (facebook_connections ordered
  // by created_at) unless the browser has a different page cached in sessionStorage —
  // which a server-rendered dashboard can't see. Scoping to that same default page
  // keeps "Total Leads" here in sync with what the user sees when they open Leads,
  // instead of summing every page the account has ever connected.
  const { data: defaultConnection } = await service
    .from('facebook_connections')
    .select('id, page_id, page_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const defaultPageId = defaultConnection?.page_id ?? null
  const defaultConnectionId = defaultConnection?.id ?? null

  // Follow-ups due today or overdue — for the sales team widget.
  // Uses service client + explicit filter so team members see their assigned leads
  // even if RLS only permits rows where user_id = auth.uid().
  let followupQuery = service
    .from('leads')
    .select('id, name, phone, lead_status, followup_at, wa_status')
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .not('followup_at', 'is', null)
    .lte('followup_at', new Date().toISOString())
    .not('lead_status', 'in', '("converted","lost","junk")')
  if (defaultPageId) followupQuery = followupQuery.eq('page_id', defaultPageId)
  const { data: followupLeads } = await followupQuery
    .order('followup_at', { ascending: true })
    .limit(5)

  const followupDue = (followupLeads ?? []) as Array<{
    id: string; name: string | null; phone: string | null
    lead_status: string | null; followup_at: string; wa_status: string
  }>

  const [analyticsRes, messagesRes, campaignsRes, leadsStatsRes, leadFormsRes, profileRes] = await Promise.all([
    store ? supabase.from('analytics_daily').select('*').eq('store_id', store.id).gte('date', thirtyDaysAgo).order('date') : Promise.resolve({ data: [] }),
    store ? supabase.from('messages').select('id,type,status,revenue_attributed,created_at,customer_name,customer_phone,message').eq('store_id', store.id).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    store ? supabase.from('campaigns').select('id,name,status,sent_count,delivered_count,read_count,revenue_attributed,created_at').eq('store_id', store.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    defaultPageId
      ? supabase.from('leads').select('lead_status, wa_status').eq('user_id', user.id).eq('page_id', defaultPageId)
      : supabase.from('leads').select('lead_status, wa_status').eq('user_id', user.id),
    defaultConnectionId
      ? supabase.from('lead_form_automations').select('is_enabled').eq('user_id', user.id).eq('connection_id', defaultConnectionId)
      : supabase.from('lead_form_automations').select('is_enabled').eq('user_id', user.id),
    supabase.from('user_profiles').select('missed_call_followup_enabled').eq('id', user.id).maybeSingle(),
  ])

  const analytics = analyticsRes.data ?? []
  const recentMessages = messagesRes.data ?? []
  const recentCampaigns = (campaignsRes.data ?? []) as Array<{
    id: string; name: string; status: string; sent_count: number;
    delivered_count: number; read_count?: number; revenue_attributed?: number; created_at: string
  }>

  // Lead-gen KPIs — this business runs on Facebook Lead Ads, not Shopify, so
  // revenue/cart/COD figures from analytics_daily are always zero and misleading.
  const leadStats = leadsStatsRes.data ?? []
  const totalLeads = leadStats.length
  const hotLeads = leadStats.filter(l => l.lead_status === 'hot').length
  const respondedLeads = leadStats.filter(l => l.wa_status === 'sent').length
  const convertedLeads = leadStats.filter(l => l.lead_status === 'converted').length
  const responseRate = totalLeads > 0 ? Math.round((respondedLeads / totalLeads) * 100) : 0
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  const leadForms = leadFormsRes.data ?? []
  const activeLeadForms = leadForms.filter(f => f.is_enabled).length
  const missedCallFollowupOn = profileRes.data?.missed_call_followup_enabled ?? false

  const totals = analytics.reduce(
    (acc, row) => ({
      sent:      acc.sent      + (row.messages_sent ?? 0),
      delivered: acc.delivered + (row.messages_delivered ?? 0),
    }),
    { sent: 0, delivered: 0 }
  )

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
    <div className="p-4 md:p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 md:mb-7">
        <div className="min-w-0">
          <p className="text-slate-400 text-xs sm:text-sm">{greeting}</p>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-0.5 truncate">
            {store?.shop_name ?? 'Your Store'}<span className="hidden md:inline"> Dashboard</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Link href="/dashboard/automations"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm">
            <Zap size={14} className="text-[#25D366]" /> Automations
          </Link>
          <Link href="/dashboard/campaigns"
            className="flex items-center gap-1.5 text-sm font-medium bg-[#25D366] text-white px-3 py-2 rounded-xl hover:bg-[#1aad54] transition active:scale-[0.97] shadow-sm">
            <Send size={14} /> New Campaign
          </Link>
        </div>
      </div>


      {/* Low message credit banner */}
      {msgPct >= 80 && msgLimit < 999_999_999 && (
        <div className={`rounded-2xl p-4 mb-5 md:mb-6 flex flex-wrap items-center gap-3 sm:gap-4 ${msgPct >= 95 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${msgPct >= 95 ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertCircle size={18} className={msgPct >= 95 ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <p className={`font-semibold text-sm ${msgPct >= 95 ? 'text-red-800' : 'text-amber-800'}`}>
              {msgPct >= 95 ? 'Message limit almost reached' : `${msgPct}% of monthly messages used`}
            </p>
            <p className={`text-xs mt-0.5 ${msgPct >= 95 ? 'text-red-600' : 'text-amber-600'}`}>
              {msgLeft.toLocaleString()} messages remaining this month — automations will pause when the limit is hit.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="text-right hidden sm:block">
              <p className={`text-xs font-bold tabular-nums ${msgPct >= 95 ? 'text-red-700' : 'text-amber-700'}`}>
                {msgUsed.toLocaleString()} / {msgLimit.toLocaleString()}
              </p>
              <div className="w-24 h-1.5 bg-black/10 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${msgPct >= 95 ? 'bg-red-500' : 'bg-amber-400'}`}
                  style={{ width: `${msgPct}%` }}
                />
              </div>
            </div>
            <Link href="/dashboard/settings?tab=billing"
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap ${msgPct >= 95 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
              Upgrade plan
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

      {/* Lead KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 md:mb-6">
        {[
          {
            label: 'Total Leads', value: formatNumber(totalLeads),
            icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50',
            sub: totalLeads > 0 ? `${responseRate}% messaged` : 'from Facebook Lead Ads',
            trend: totalLeads > 0,
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
            label: 'Hot Leads', value: formatNumber(hotLeads),
            icon: Target, color: 'text-orange-600', bg: 'bg-orange-50',
            sub: totalLeads > 0 ? `${conversionRate}% converted` : 'tag leads to track',
            trend: hotLeads > 0,
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-slate-500 text-xs font-medium min-w-0 truncate">{card.label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <card.icon size={15} className={card.color} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">{card.value}</p>
            <p className="text-slate-400 text-[11px] sm:text-xs mt-1 flex items-center gap-1 overflow-hidden">
              {card.trend && <TrendingUp size={11} className="text-emerald-500" />}
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-5 md:mb-6">

        {/* Message volume sparkline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
          <h2 className="font-semibold text-slate-800 mb-4">Performance</h2>
          <div className="space-y-3.5">
            {[
              { label: 'Delivery Rate',   value: totals.sent > 0 ? `${deliveryRate}%` : '—', color: 'bg-blue-500', pct: deliveryRate },
              { label: 'Read Rate',       value: totals.sent > 0 ? `${readRate}%` : '—',     color: 'bg-purple-500', pct: readRate },
              { label: 'Response Rate',   value: totalLeads > 0 ? `${responseRate}%` : '—',  color: 'bg-emerald-500', pct: responseRate },
              { label: 'Conversion Rate', value: totalLeads > 0 ? `${conversionRate}%` : '—', color: 'bg-orange-400', pct: conversionRate },
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
        </div>
      </div>

      {/* Follow-ups due widget — only shown when there are due leads */}
      {followupDue.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mb-5 md:mb-6">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-amber-100 bg-amber-50/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone size={14} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Follow-ups Due</h2>
                <p className="text-[11px] text-amber-600">
                  {followupDue.length} lead{followupDue.length !== 1 ? 's' : ''} waiting for a call
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/leads?sort=followup_due"
              className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1 flex-shrink-0"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {followupDue.map(lead => {
              const dueDate = new Date(lead.followup_at)
              const isToday = dueDate.toDateString() === new Date().toDateString()
              const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000)
              const statusColors: Record<string, string> = {
                hot:  'bg-red-100 text-red-700',
                warm: 'bg-amber-100 text-amber-700',
                cold: 'bg-blue-100 text-blue-700',
              }
              const statusCls = statusColors[lead.lead_status ?? ''] ?? 'bg-slate-100 text-slate-500'
              return (
                <Link
                  key={lead.id}
                  href="/dashboard/leads?sort=followup_due"
                  className="flex items-center gap-2.5 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-amber-50/30 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 text-xs font-bold">
                    {(lead.name ?? lead.phone ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {lead.name ?? lead.phone ?? 'Unknown'}
                    </p>
                    {lead.phone && lead.name && (
                      <p className="text-xs text-slate-400 truncate">{lead.phone}</p>
                    )}
                  </div>
                  {lead.lead_status && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusCls}`}>
                      {lead.lead_status}
                    </span>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Calendar size={11} className={isToday && daysOverdue < 1 ? 'text-amber-500' : 'text-red-400'} />
                    <span className={`text-[11px] font-medium whitespace-nowrap ${daysOverdue >= 1 ? 'text-red-500' : 'text-amber-500'}`}>
                      {daysOverdue >= 1 ? `${daysOverdue}d overdue` : 'Today'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom: recent messages + campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Messages</h2>
            <Link href="/dashboard/live-chat" className="text-[#25D366] text-xs font-medium flex items-center gap-1 hover:underline">
              Live Chat <ArrowRight size={12} />
            </Link>
          </div>

          {recentMessages.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {recentMessages.map((msg: { id: string; customer_name?: string; customer_phone: string; message: string; type: string; status: string; created_at: string }) => (
                <div key={msg.id} className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/70 transition">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 text-[#25D366] text-xs font-bold">
                    {(msg.customer_name ?? msg.customer_phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{msg.customer_name ?? msg.customer_phone}</p>
                    <p className="text-xs text-slate-400 truncate">{msg.message.slice(0, 55)}…</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="hidden sm:inline-block text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
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
        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* Automation status */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Automations</h3>
              <Link href="/dashboard/automations" className="text-[#25D366] text-xs font-medium hover:underline">Manage</Link>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-xs">Lead Ad Response</span>
                {leadForms.length > 0 ? (
                  <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${activeLeadForms > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {activeLeadForms > 0 && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                    {activeLeadForms} of {leadForms.length} forms
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Not set up</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-xs">Missed Call Follow-up</span>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${missedCallFollowupOn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {missedCallFollowupOn
                    ? <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> On</>
                    : 'Off'}
                </span>
              </div>
            </div>
          </div>

          {/* Top campaigns */}
          {recentCampaigns.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
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
          <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-4 sm:p-5 text-white">
            <MousePointerClick size={18} className="mb-2 opacity-80" />
            <p className="font-semibold text-sm">Speed to lead wins deals</p>
            <p className="text-green-100 text-xs mt-1 leading-relaxed">Leads messaged within 5 minutes convert up to 9x more often than those contacted an hour later.</p>
            <Link href="/dashboard/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
              View leads <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

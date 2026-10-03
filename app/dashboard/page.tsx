export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  IndianRupee, MessageSquare, TrendingUp,
  ArrowRight, Zap, AlertCircle, CheckCircle2,
  Send, Eye, MousePointerClick, Users, Target,
  Phone, Calendar, BarChart2, Package, ShoppingCart,
} from 'lucide-react'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils'
import Link from 'next/link'
import WhatsAppStatusBanner from '@/components/whatsapp-status-banner'
import WaHealthBadge from '@/components/wa-health-badge'
import { pickPreferredStore } from '@/lib/store-selection'
import { resolveManagedOrg } from '@/lib/resolve-managed-org'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { canAccess } from '@/lib/user-role'

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-[#25D366]/10 text-[#25D366]',
  admin:   'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  member:  'bg-slate-100 text-slate-600',
  support: 'bg-amber-100 text-amber-700',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  // Every query below that used to be scoped to `user.id` needs the org OWNER's id
  // instead — stores, whatsapp_accounts, billing, facebook_connections and leads all
  // predate the team model and are keyed by the owner's own auth id, not the logged-in
  // caller's. This page previously queried all of them by `user.id` directly, so an
  // invited teammate (Sales/Support/Manager) saw an empty dashboard — or worse, if
  // that email had its own separate pre-existing Wapaci store from before being
  // invited, they'd see THAT unrelated store's dashboard instead of the org they were
  // actually invited into. resolveOwnerUserId returns userId itself when there's no
  // active team membership, so this is a no-op for a genuine owner/solo account.
  const ownerId = await resolveOwnerUserId(service, user.id)
  const role = await getUserRole(user.id, user.email ?? '')
  const canManageWhatsApp = role === 'owner' || role === 'admin'
  const canSeeAutomations = canAccess(role, '/dashboard/automations')
  const canSeeCampaigns   = canAccess(role, '/dashboard/campaigns')

  const { data: storeRows } = await service
    .from('stores')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  let store = pickPreferredStore(storeRows)

  // Auto-provision only for a genuine self-serve signup (no active team membership
  // resolved above) — an invited teammate must never get their own stray store here,
  // since that would make getUserRole() classify them as 'owner' of an empty account
  // instead of the role they were actually invited with.
  if (!store && ownerId === user.id) {
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
  const { data: waAccount } = await service
    .from('whatsapp_accounts')
    .select('display_phone_number, token_type, status')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()

  const waConnected = !!waAccount
  const waPhone     = waAccount?.display_phone_number ?? store?.whatsapp_number ?? null
  // Also consider store.whatsapp_bsp as a fallback for older records
  const waFallback  = !waConnected && store?.whatsapp_bsp === 'meta' && !!store?.whatsapp_number

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Drives which stat cards/widgets render below — never a hard feature gate
  // (every account can still reach Leads, Shopify, etc. from the nav), just
  // which metrics are the DEFAULT view. NULL (not yet chosen, or pre-dates
  // this column) degrades to 'lead_gen', today's existing behavior.
  const businessType: 'ecommerce' | 'lead_gen' = store?.business_type === 'ecommerce' ? 'ecommerce' : 'lead_gen'
  const isEcommerce = businessType === 'ecommerce'

  // Billing usage for low-credit banner
  const { data: billing } = await service
    .from('billing')
    .select('messages_limit, messages_used')
    .eq('user_id', ownerId)
    .maybeSingle()

  const msgLimit = billing?.messages_limit ?? 500
  const msgUsed  = billing?.messages_used  ?? 0
  const msgPct   = msgLimit >= 999_999_999 ? 0 : Math.min(100, Math.round((msgUsed / msgLimit) * 100))
  const msgLeft  = Math.max(0, msgLimit - msgUsed)

  // The widgets below (Follow-ups Due, Team Activity, Lead KPIs, Lead Outcomes/
  // Sources) are all lead-gen concepts — skipped entirely for an ecommerce
  // account rather than querying data that would just render empty.
  let defaultPageId: string | null = null
  let defaultConnectionId: string | null = null
  let followupDue: Array<{
    id: string; name: string | null; phone: string | null
    lead_status: string | null; followup_at: string; wa_status: string
  }> = []
  type TeamActivityRow = {
    user_id: string; email: string; role: string
    leads_assigned: number; converted: number; calls_logged: number; last_activity_at: string | null
  }
  let teamActivity: TeamActivityRow[] = []

  if (!isEcommerce) {
    // Lead-based dashboard metrics need to match what the Leads page shows by default:
    // it defaults to the earliest-connected Facebook Page (facebook_connections ordered
    // by created_at) unless the browser has a different page cached in sessionStorage —
    // which a server-rendered dashboard can't see. Scoping to that same default page
    // keeps "Total Leads" here in sync with what the user sees when they open Leads,
    // instead of summing every page the account has ever connected.
    const { data: defaultConnection } = await service
      .from('facebook_connections')
      .select('id, page_id, page_name')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    defaultPageId = defaultConnection?.page_id ?? null
    defaultConnectionId = defaultConnection?.id ?? null

    // Follow-ups due today or overdue — for the sales team widget. Org-owned leads OR
    // ones specifically assigned to this viewer, same visibility rule used elsewhere
    // (e.g. /api/facebook/leads) — a rep sees the org's pool plus their own assignments.
    let followupQuery = service
      .from('leads')
      .select('id, name, phone, lead_status, followup_at, wa_status')
      .or(`user_id.eq.${ownerId},assigned_to.eq.${user.id}`)
      .not('followup_at', 'is', null)
      .lte('followup_at', new Date().toISOString())
      .not('lead_status', 'in', '("converted","lost","junk")')
    if (defaultPageId) followupQuery = followupQuery.eq('page_id', defaultPageId)
    const { data: followupLeads } = await followupQuery
      .order('followup_at', { ascending: true })
      .limit(5)

    followupDue = (followupLeads ?? []) as typeof followupDue

    // Team Activity — owner/admin only, mirrors /api/settings/team-activity's gate
    // (resolveManagedOrg returns null for a Sales/Support/Manager rep, so this stays
    // empty and the section below just doesn't render for them).
    const managedOrg = await resolveManagedOrg(service, user.id, user.email ?? '')
    if (managedOrg) {
      let ownerEmail = user.email ?? ''
      if (ownerId !== user.id) {
        const { data: ownerUser } = await service.auth.admin.getUserById(ownerId)
        ownerEmail = ownerUser?.user?.email ?? ownerEmail
      }
      const { data: orgMembers } = await service
        .from('team_members')
        .select('id, user_id, email, role')
        .eq('organization_id', managedOrg.id)
        .eq('status', 'active')
        .not('user_id', 'is', null)

      const people = [
        { user_id: ownerId, email: ownerEmail, role: 'owner' },
        ...(orgMembers ?? []).map(m => ({ user_id: m.user_id as string, email: m.email as string, role: m.role as string })),
      ]
      const peopleIds = people.map(p => p.user_id)

      const [{ data: activityLeads }, { data: callLogs }] = await Promise.all([
        service.from('leads').select('assigned_to, lead_status').eq('user_id', ownerId),
        service.from('call_logs').select('called_by, created_at').in('called_by', peopleIds),
      ])

      teamActivity = people
        .map(person => {
          const assigned = (activityLeads ?? []).filter(l => l.assigned_to === person.user_id)
          const converted = assigned.filter(l => l.lead_status === 'converted').length
          const calls = (callLogs ?? []).filter(c => c.called_by === person.user_id)
          const lastActivityAt = calls.reduce<string | null>((latest, c) => {
            const t = c.created_at as string
            return !latest || t > latest ? t : latest
          }, null)
          return {
            user_id: person.user_id, email: person.email, role: person.role,
            leads_assigned: assigned.length, converted, calls_logged: calls.length,
            last_activity_at: lastActivityAt,
          }
        })
        .sort((a, b) => b.calls_logged - a.calls_logged)
    }
  }

  const [
    analyticsRes, messagesRes, campaignsRes, leadsStatsRes, leadFormsRes, profileRes, leadJobsRes, leadSourcesRes,
    custRes, orderStatsRes, checkoutStatsRes, recentOrdersRes, ecomAutosRes,
  ] = await Promise.all([
    store ? service.from('analytics_daily').select('*').eq('store_id', store.id).gte('date', thirtyDaysAgo).order('date') : Promise.resolve({ data: [] }),
    store ? service.from('messages').select('id,type,status,revenue_attributed,created_at,customer_name,customer_phone,message').eq('store_id', store.id).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    store ? service.from('campaigns').select('id,name,status,sent_count,delivered_count,read_count,revenue_attributed,created_at').eq('store_id', store.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    isEcommerce ? Promise.resolve({ data: [] }) : defaultPageId
      ? service.from('leads').select('phone, created_at, lead_status, wa_status').eq('user_id', ownerId).eq('page_id', defaultPageId)
      : service.from('leads').select('phone, created_at, lead_status, wa_status').eq('user_id', ownerId),
    isEcommerce ? Promise.resolve({ data: [] }) : defaultConnectionId
      ? service.from('lead_form_automations').select('is_enabled').eq('user_id', ownerId).eq('connection_id', defaultConnectionId)
      : service.from('lead_form_automations').select('is_enabled').eq('user_id', ownerId),
    // Deliberately per-viewer (not owner-scoped) — each teammate has their own
    // user_profiles row and their own missed-call-followup preference.
    isEcommerce ? Promise.resolve({ data: null }) : supabase.from('user_profiles').select('missed_call_followup_enabled').eq('id', user.id).maybeSingle(),
    // Speed-to-lead: first automated "lead_ad" WhatsApp send per phone number, used
    // below to measure time from lead creation to first contact. Scoped to the last
    // 30 days so a handful of old bulk-resends to stale leads can't skew the median.
    isEcommerce || !store ? Promise.resolve({ data: [] })
      : service.from('automation_jobs').select('customer_phone, sent_at')
          .eq('store_id', store.id).eq('type', 'lead_ad').eq('status', 'sent')
          .gte('sent_at', thirtyDaysAgo).order('sent_at', { ascending: true }),
    // Lead Sources breakdown is deliberately NOT page-scoped like leadStats
    // above — non-Facebook sources (walk-in, referral, channel partner,
    // landing page) have no page_id at all, so filtering by defaultPageId
    // would silently exclude every one of them and always show 100% Facebook.
    isEcommerce ? Promise.resolve({ data: [] }) : service.from('leads').select('source').eq('user_id', ownerId),

    // Ecommerce-only — same queries already proven correct on /dashboard/shopify
    // (shopify_orders/shopify_abandoned_checkouts get written by the webhook
    // handler for either Shopify connection type, so these aren't gated on
    // isCustomApp the way shopify_products is over there).
    isEcommerce && store ? service.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id) : Promise.resolve({ count: 0 }),
    isEcommerce && store ? service.from('shopify_orders').select('total_price', { count: 'exact' }).eq('store_id', store.id) : Promise.resolve({ data: [], count: 0 }),
    isEcommerce && store ? service.from('shopify_abandoned_checkouts').select('total_price', { count: 'exact' }).eq('store_id', store.id).is('completed_at', null) : Promise.resolve({ data: [], count: 0 }),
    isEcommerce && store ? service.from('shopify_orders').select('id, order_number, email, phone, total_price, currency, financial_status, fulfillment_status, shopify_created_at').eq('store_id', store.id).order('shopify_created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    isEcommerce && store ? service.from('automations').select('type,is_enabled').eq('store_id', store.id) : Promise.resolve({ data: [] }),
  ])

  const analytics = analyticsRes.data ?? []
  const recentMessages = messagesRes.data ?? []
  const recentCampaigns = (campaignsRes.data ?? []) as Array<{
    id: string; name: string; status: string; sent_count: number;
    delivered_count: number; read_count?: number; revenue_attributed?: number; created_at: string
  }>

  // Ecommerce KPIs — same queries/shape as /dashboard/shopify, so the numbers
  // here always match that page exactly.
  const customerCount    = custRes.count ?? 0
  const orderCount       = orderStatsRes.count ?? 0
  const revenue          = (orderStatsRes.data ?? []).reduce((sum, o) => sum + (o.total_price ?? 0), 0)
  const checkoutCount    = checkoutStatsRes.count ?? 0
  const recoverableValue = (checkoutStatsRes.data ?? []).reduce((sum, c) => sum + (c.total_price ?? 0), 0)
  const recentOrders     = recentOrdersRes.data ?? []
  const ecomAutomations  = (ecomAutosRes.data ?? []) as Array<{ type: string; is_enabled: boolean }>
  const activeEcomAutos  = ecomAutomations.filter(a => a.is_enabled).length

  // Cart/COD rates from analytics_daily's running counters — cartsRecovered is
  // completed-after-reminder checkouts, checkoutCount above is still-open
  // (abandoned) ones, so together they're the full "ever abandoned" pool.
  const cartsRecoveredTotal = analytics.reduce((sum, r) => sum + (r.carts_recovered ?? 0), 0)
  const codVerifiedTotal    = analytics.reduce((sum, r) => sum + (r.cod_verified ?? 0), 0)
  const codCancelledTotal   = analytics.reduce((sum, r) => sum + (r.cod_cancelled ?? 0), 0)
  const cartRecoveryRate = (cartsRecoveredTotal + checkoutCount) > 0
    ? Math.round((cartsRecoveredTotal / (cartsRecoveredTotal + checkoutCount)) * 100) : 0
  const codConfirmRate = (codVerifiedTotal + codCancelledTotal) > 0
    ? Math.round((codVerifiedTotal / (codVerifiedTotal + codCancelledTotal)) * 100) : 0

  // Lead-gen KPIs — naturally all-zero/empty for an ecommerce account since
  // the queries feeding these were skipped above (isEcommerce branches in the
  // Promise.all resolve to empty data), not because this business runs leads.
  const leadStats = leadsStatsRes.data ?? []
  const totalLeads = leadStats.length
  const hotLeads = leadStats.filter(l => l.lead_status === 'hot').length
  const respondedLeads = leadStats.filter(l => l.wa_status === 'sent').length
  const convertedLeads = leadStats.filter(l => l.lead_status === 'converted').length
  const responseRate = totalLeads > 0 ? Math.round((respondedLeads / totalLeads) * 100) : 0
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  // Lead Outcomes — full breakdown by the tag the sales team applies (Call Log
  // modal / lead status dropdown), not just the single converted% figure above.
  // Shows the whole funnel: how much of what's coming in is actually good.
  const LEAD_OUTCOME_META: Record<string, { label: string; color: string; dot: string }> = {
    converted: { label: 'Converted', color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    hot:       { label: 'Hot',       color: 'bg-red-500',     dot: 'bg-red-500' },
    warm:      { label: 'Warm',      color: 'bg-orange-400',  dot: 'bg-orange-400' },
    cold:      { label: 'Cold',      color: 'bg-indigo-400',  dot: 'bg-indigo-400' },
    resolved:  { label: 'Resolved',  color: 'bg-blue-400',    dot: 'bg-blue-400' },
    lost:      { label: 'Lost',      color: 'bg-slate-400',   dot: 'bg-slate-400' },
    junk:      { label: 'Junk',      color: 'bg-slate-300',   dot: 'bg-slate-300' },
    untagged:  { label: 'Untagged',  color: 'bg-slate-200',   dot: 'bg-slate-200' },
  }
  const outcomeCounts: Record<string, number> = {}
  for (const l of leadStats) {
    const key = (l.lead_status && LEAD_OUTCOME_META[l.lead_status]) ? l.lead_status : 'untagged'
    outcomeCounts[key] = (outcomeCounts[key] ?? 0) + 1
  }
  const leadOutcomes = Object.keys(LEAD_OUTCOME_META)
    .map(key => ({
      key,
      ...LEAD_OUTCOME_META[key],
      count: outcomeCounts[key] ?? 0,
      pct: totalLeads > 0 ? Math.round(((outcomeCounts[key] ?? 0) / totalLeads) * 100) : 0,
    }))
    .filter(o => o.count > 0)

  // Lead Sources — which channel actually brings leads in, across every
  // source (Facebook, landing page, walk-in, referral, channel partner), not
  // just the Facebook-page-scoped totals above.
  const SOURCE_META: Record<string, { label: string; color: string; dot: string }> = {
    facebook_lead_ad: { label: 'Facebook',        color: 'bg-blue-500',   dot: 'bg-blue-500' },
    landing_page:      { label: 'Landing Page',    color: 'bg-purple-500', dot: 'bg-purple-500' },
    walk_in:           { label: 'Walk-in',         color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    referral:          { label: 'Referral',        color: 'bg-teal-500',   dot: 'bg-teal-500' },
    channel_partner:   { label: 'Channel Partner', color: 'bg-orange-400', dot: 'bg-orange-400' },
    manual:            { label: 'Manual',          color: 'bg-slate-400', dot: 'bg-slate-400' },
    other:             { label: 'Other',           color: 'bg-slate-300', dot: 'bg-slate-300' },
  }
  const allLeadsForSources = leadSourcesRes.data ?? []
  const totalLeadsAllSources = allLeadsForSources.length
  const sourceCounts: Record<string, number> = {}
  for (const l of allLeadsForSources) {
    const key = (l.source && SOURCE_META[l.source]) ? l.source : 'facebook_lead_ad'
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1
  }
  const leadSources = Object.keys(SOURCE_META)
    .map(key => ({
      key,
      ...SOURCE_META[key],
      count: sourceCounts[key] ?? 0,
      pct: totalLeadsAllSources > 0 ? Math.round(((sourceCounts[key] ?? 0) / totalLeadsAllSources) * 100) : 0,
    }))
    .filter(s => s.count > 0)

  const leadForms = leadFormsRes.data ?? []
  const activeLeadForms = leadForms.filter(f => f.is_enabled).length
  const missedCallFollowupOn = profileRes.data?.missed_call_followup_enabled ?? false

  // Speed-to-lead: median minutes from lead creation to the first automated WhatsApp
  // send to that phone number. Earliest sent_at per phone (leadJobsRes is already
  // ordered ascending), matched against each lead's own created_at. Median rather
  // than mean — a few delayed/bulk-resent leads shouldn't drag the "typical" number.
  const firstSentByPhone = new Map<string, string>()
  for (const job of leadJobsRes.data ?? []) {
    const phone = job.customer_phone as string
    if (phone && !firstSentByPhone.has(phone)) firstSentByPhone.set(phone, job.sent_at as string)
  }
  const responseMinutes = leadStats
    .map(l => {
      if (!l.phone || !l.created_at) return null
      const sentAt = firstSentByPhone.get(l.phone)
      if (!sentAt) return null
      const mins = (new Date(sentAt).getTime() - new Date(l.created_at).getTime()) / 60000
      return mins >= 0 ? mins : null
    })
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b)

  const medianResponseMinutes = responseMinutes.length > 0
    ? responseMinutes[Math.floor(responseMinutes.length / 2)]
    : null

  const formatMinutes = (mins: number) => {
    if (mins < 1) return '<1 min'
    if (mins < 60) return `${Math.round(mins)} min`
    const hours = Math.floor(mins / 60)
    const rem = Math.round(mins % 60)
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  }

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

  // Performance section's last two stats swap by business type — Response/
  // Conversion Rate are lead concepts, Cart Recovery/COD Confirm are ecom ones.
  const perfStats = isEcommerce
    ? [
        { label: 'Delivery Rate',       value: totals.sent > 0 ? `${deliveryRate}%` : '—', color: 'bg-blue-500', pct: deliveryRate },
        { label: 'Read Rate',           value: totals.sent > 0 ? `${readRate}%` : '—',     color: 'bg-purple-500', pct: readRate },
        { label: 'Cart Recovery Rate',  value: (cartsRecoveredTotal + checkoutCount) > 0 ? `${cartRecoveryRate}%` : '—', color: 'bg-emerald-500', pct: cartRecoveryRate },
        { label: 'COD Confirm Rate',    value: (codVerifiedTotal + codCancelledTotal) > 0 ? `${codConfirmRate}%` : '—', color: 'bg-orange-400', pct: codConfirmRate },
      ]
    : [
        { label: 'Delivery Rate',   value: totals.sent > 0 ? `${deliveryRate}%` : '—', color: 'bg-blue-500', pct: deliveryRate },
        { label: 'Read Rate',       value: totals.sent > 0 ? `${readRate}%` : '—',     color: 'bg-purple-500', pct: readRate },
        { label: 'Response Rate',   value: totalLeads > 0 ? `${responseRate}%` : '—',  color: 'bg-emerald-500', pct: responseRate },
        { label: 'Conversion Rate', value: totalLeads > 0 ? `${conversionRate}%` : '—', color: 'bg-orange-400', pct: conversionRate },
      ]

  // Top stat-card grid — same card component either way, different data.
  const kpiCards = isEcommerce
    ? [
        {
          label: 'Orders', value: formatNumber(orderCount),
          icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50',
          sub: orderCount > 0 ? formatCurrency(revenue) + ' revenue' : 'from Shopify',
          trend: orderCount > 0,
        },
        {
          label: 'Revenue', value: formatCurrency(revenue),
          icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50',
          sub: `${formatNumber(orderCount)} orders`,
          trend: revenue > 0,
        },
        {
          label: 'Abandoned Checkouts', value: formatNumber(checkoutCount),
          icon: Package, color: 'text-orange-600', bg: 'bg-orange-50',
          sub: checkoutCount > 0 ? `${formatCurrency(recoverableValue)} recoverable` : 'none open',
          trend: checkoutCount > 0,
        },
        {
          label: 'Reachable on WhatsApp', value: formatNumber(customerCount),
          icon: Users, color: 'text-purple-600', bg: 'bg-purple-50',
          sub: 'customers synced',
          trend: customerCount > 0,
        },
      ]
    : [
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
      ]

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
        {(canSeeAutomations || canSeeCampaigns) && (
          <div className="hidden md:flex items-center gap-2">
            {canSeeAutomations && (
              <Link href="/dashboard/automations"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm">
                <Zap size={14} className="text-[#25D366]" /> Automations
              </Link>
            )}
            {canSeeCampaigns && (
              <Link href="/dashboard/campaigns"
                className="flex items-center gap-1.5 text-sm font-medium bg-[#25D366] text-white px-3 py-2 rounded-xl hover:bg-[#1aad54] transition active:scale-[0.97] shadow-sm">
                <Send size={14} /> New Campaign
              </Link>
            )}
          </div>
        )}
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

      {/* WhatsApp connection banner — the "not connected, connect now" CTA is an
          owner/admin setup action (adding a phone number), so it's hidden for
          Sales/Support/Manager. The connected-state badge is still shown to
          everyone since it's just informational, not something to act on. */}
      {(canManageWhatsApp || waConnected || waFallback) && (
        <WhatsAppStatusBanner
          connected={waConnected || waFallback}
          phone={waPhone}
          tokenType={waAccount?.token_type ?? null}
        />
      )}

      {/* WhatsApp account health (restricted/quality dropping) — previously
          only ever shown in the desktop sidebar, so a mobile-only user had
          zero visibility into a business-critical alert that directly
          threatens their ability to send messages. md:hidden since desktop
          already shows this in the sidebar; renders nothing itself when
          there's no issue, so no wrapper/margin is reserved for it. */}
      <div className="md:hidden">
        <WaHealthBadge variant="light" />
      </div>

      {/* Top KPIs — Orders/Revenue/Checkouts/Customers for ecommerce, Leads/
          Messages/Read Rate/Hot Leads for lead-gen (§5 of the business-type
          plan: never a feature gate, just the right numbers for the account). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 md:mb-6">
        {kpiCards.map(card => (
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

      {/* Team Activity — owner/admin only. Same data as Settings → Team, surfaced
          here too so it doesn't require a trip to Settings to check on the team. */}
      {teamActivity.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 mb-5 md:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Team Activity</h2>
                <p className="text-slate-400 text-xs mt-0.5">Who&apos;s working which leads, and how much</p>
              </div>
            </div>
            <Link href="/dashboard/settings?tab=team" className="text-[#25D366] text-xs font-medium hover:underline flex-shrink-0">
              Manage
            </Link>
          </div>

          <div className="space-y-2">
            {teamActivity.map(person => {
              const rate = person.leads_assigned > 0
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
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize flex-shrink-0 ${ROLE_COLORS[person.role] ?? ROLE_COLORS.member}`}>
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
                        <Phone size={11} className="text-slate-400" /> {person.calls_logged}
                      </p>
                      <p className="text-[10px] text-slate-400">calls</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{person.leads_assigned}</p>
                      <p className="text-[10px] text-slate-400">leads</p>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold tabular-nums flex items-center gap-1 justify-end ${rate > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        <Target size={11} className="text-slate-400" /> {rate}%
                      </p>
                      <p className="text-[10px] text-slate-400">converted</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                {canSeeAutomations && (
                  <Link href="/dashboard/automations" className="text-[#25D366] text-xs font-medium hover:underline mt-1 inline-block">
                    Enable automations →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
          <h2 className="font-semibold text-slate-800 mb-4">Performance</h2>
          <div className="space-y-3.5">
            {perfStats.map(stat => (
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

      {/* Lead Outcomes + Lead Sources — side by side on wider screens, stacked on mobile */}
      {(totalLeads > 0 || totalLeadsAllSources > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5 md:mb-6">
          {totalLeads > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">Lead Outcomes</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Based on tags your team applies to leads</p>
                </div>
                <span className="text-xs font-medium text-slate-400">{formatNumber(totalLeads)} total</span>
              </div>

              {leadOutcomes.length > 0 && (
                <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100 mb-4">
                  {leadOutcomes.map(o => (
                    <div
                      key={o.key}
                      className={`${o.color} h-full first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${o.pct}%` }}
                      title={`${o.label}: ${o.count} (${o.pct}%)`}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                {leadOutcomes.map(o => (
                  <div key={o.key} className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.dot}`} />
                    <span className="text-xs text-slate-500 truncate">{o.label}</span>
                    <span className="text-xs font-semibold text-slate-800 ml-auto flex-shrink-0">{o.count}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 w-9 text-right">{o.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lead Sources — which channel actually brings leads in, across
              Facebook, landing page, walk-ins, referrals, and channel partners */}
          {totalLeadsAllSources > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">Lead Sources</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Where your leads are actually coming from</p>
                </div>
                <span className="text-xs font-medium text-slate-400">{formatNumber(totalLeadsAllSources)} total</span>
              </div>

              {leadSources.length > 0 && (
                <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100 mb-4">
                  {leadSources.map(s => (
                    <div
                      key={s.key}
                      className={`${s.color} h-full first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${s.pct}%` }}
                      title={`${s.label}: ${s.count} (${s.pct}%)`}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                {leadSources.map(s => (
                  <div key={s.key} className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className="text-xs text-slate-500 truncate">{s.label}</span>
                    <span className="text-xs font-semibold text-slate-800 ml-auto flex-shrink-0">{s.count}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 w-9 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Orders — ecommerce counterpart to Lead Outcomes/Sources above.
          Full detail (abandoned checkouts, products, webhook status) lives on
          /dashboard/shopify; this is just a glanceable recent-activity list. */}
      {isEcommerce && recentOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5 md:mb-6">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Orders</h2>
            <Link href="/dashboard/shopify" className="text-[#25D366] text-xs font-medium flex items-center gap-1 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentOrders.map((o: { id: string; order_number: number | string; email: string | null; phone: string | null; total_price: number; currency: string; financial_status: string | null; fulfillment_status: string | null; shopify_created_at: string }) => (
              <div key={o.id} className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 text-xs font-bold">
                  #{String(o.order_number).slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">Order #{o.order_number}</p>
                  <p className="text-xs text-slate-400 truncate">{o.email ?? o.phone ?? '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(o.total_price)}</span>
                  <span className="text-[10px] text-slate-300">{timeAgo(o.shopify_created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {canSeeAutomations ? (
                <>
                  <p className="text-slate-400 text-xs mt-1">Enable automations to start sending WhatsApp messages</p>
                  <Link href="/dashboard/automations" className="mt-3 inline-flex items-center gap-1 text-sm text-[#25D366] font-medium hover:underline">
                    Set up automations <ArrowRight size={13} />
                  </Link>
                </>
              ) : (
                <p className="text-slate-400 text-xs mt-1">Messages will appear here once automations are set up</p>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* Automation status — owner/admin/manager only (matches nav access);
              a Sales/Support rep can't act on any of this, so it's just noise. */}
          {canSeeAutomations && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Automations</h3>
                <Link href="/dashboard/automations" className="text-[#25D366] text-xs font-medium hover:underline">Manage</Link>
              </div>
              {isEcommerce ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 text-xs">Revenue Automations</span>
                    {ecomAutomations.length > 0 ? (
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${activeEcomAutos > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {activeEcomAutos > 0 && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                        {activeEcomAutos} of {ecomAutomations.length} active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Not set up</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 text-xs">Cart Recovery Rate</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {(cartsRecoveredTotal + checkoutCount) > 0 ? `${cartRecoveryRate}%` : '—'}
                    </span>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          )}

          {/* Top campaigns */}
          {canSeeCampaigns && recentCampaigns.length > 0 && (
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

          {/* CTA card — ecommerce variant highlights the account's own
              recoverable cart value; lead-gen variant shows measured
              speed-to-lead, both once there's data instead of just
              asserting the value in the abstract. */}
          {isEcommerce ? (
            <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-4 sm:p-5 text-white">
              <ShoppingCart size={18} className="mb-2 opacity-80" />
              {checkoutCount > 0 ? (
                <>
                  <p className="font-semibold text-sm">
                    {formatCurrency(recoverableValue)} in abandoned carts
                  </p>
                  <p className="text-green-100 text-xs mt-1 leading-relaxed">
                    {checkoutCount} open checkout{checkoutCount !== 1 ? 's' : ''} right now — a WhatsApp reminder recovers 15–25% on average.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm">Recover lost sales automatically</p>
                  <p className="text-green-100 text-xs mt-1 leading-relaxed">Abandoned cart reminders over WhatsApp recover 15–25% of lost sales on average.</p>
                </>
              )}
              <Link href="/dashboard/shopify" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
                View Shopify <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-4 sm:p-5 text-white">
              <MousePointerClick size={18} className="mb-2 opacity-80" />
              {medianResponseMinutes !== null ? (
                <>
                  <p className="font-semibold text-sm">
                    Your leads hear back in {formatMinutes(medianResponseMinutes)}
                  </p>
                  <p className="text-green-100 text-xs mt-1 leading-relaxed">
                    {medianResponseMinutes <= 5
                      ? "That's fast — leads messaged within 5 minutes convert up to 9x more than those contacted an hour later."
                      : 'Leads messaged within 5 minutes convert up to 9x more than those contacted an hour later. Faster Lead Ad Response setup can close that gap.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm">Speed to lead wins deals</p>
                  <p className="text-green-100 text-xs mt-1 leading-relaxed">Leads messaged within 5 minutes convert up to 9x more often than those contacted an hour later.</p>
                </>
              )}
              <Link href="/dashboard/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white hover:underline">
                View leads <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

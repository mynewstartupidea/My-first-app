export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import {
  ShoppingBag, CheckCircle2, Zap,
  ArrowRight, Link2, Webhook, Megaphone, Package, ShoppingCart, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import { timeAgo, formatCurrency, cn } from '@/lib/utils'
import { pickPreferredStore } from '@/lib/store-selection'
import { getUserRole } from '@/lib/get-user-role'
import ShopifySyncNowButton from '@/components/shopify-sync-now-button'

// Same avatar-initials/color scheme as Contacts (app/dashboard/contacts/page.tsx)
// so a shopper shows up looking like the same "person" whether you first see
// them here or in Contacts.
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-600',
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-orange-100 text-orange-600',
  'bg-pink-100 text-pink-600',
  'bg-cyan-100 text-cyan-600',
]
function avatarColor(key: string) {
  return AVATAR_COLORS[key.charCodeAt(key.length - 1) % AVATAR_COLORS.length]
}
function avatarInitials(name: string | null, fallback: string) {
  if (name) return name.slice(0, 2).toUpperCase()
  return fallback.slice(-2)
}

export default async function ShopifyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolved to the org owner — stores is keyed by the owner's user_id, a
  // teammate querying by their own id (the previous version of this page)
  // found nothing and always showed "not connected".
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const role = await getUserRole(user.id, user.email ?? '')
  const canConnect = role === 'owner' || role === 'admin'

  const { data: storeRows } = await service
    .from('stores').select('*').eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const preferredStore = pickPreferredStore(storeRows)
  const store = preferredStore?.shopify_domain ? preferredStore : null
  const isCustomApp = store?.shopify_connection_type === 'custom_app'

  // shopify_orders/shopify_abandoned_checkouts get written by the webhook
  // handler (app/api/shopify/webhooks/route.ts) for EITHER connection type —
  // it only branches on shopify_connection_type to pick the right HMAC
  // secret, not to decide whether to mirror data. Gating these queries
  // behind isCustomApp meant an oauth_app store (currently dormant, but the
  // backend path is deliberately kept alive for a possible future
  // re-enable) would show zero orders/revenue/checkouts here despite real
  // rows existing for it. Only shopify_products is genuinely custom_app-only
  // — the legacy oauth sync path never wrote that table, only
  // stores.product_count (shown elsewhere, not on this page).
  const [
    custRes, autoRes, orderStatsRes, checkoutStatsRes, productRes,
    recentOrdersRes, recentCheckoutsRes,
  ] = await Promise.all([
    store ? service.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id) : Promise.resolve({ count: 0 }),
    store ? service.from('automations').select('type,is_enabled').eq('store_id', store.id) : Promise.resolve({ data: [] }),
    store ? service.from('shopify_orders').select('total_price', { count: 'exact' }).eq('store_id', store.id) : Promise.resolve({ data: [], count: 0 }),
    store ? service.from('shopify_abandoned_checkouts').select('total_price', { count: 'exact' }).eq('store_id', store.id).is('completed_at', null) : Promise.resolve({ data: [], count: 0 }),
    store && isCustomApp ? service.from('shopify_products').select('id', { count: 'exact', head: true }).eq('store_id', store.id) : Promise.resolve({ count: 0 }),
    store ? service.from('shopify_orders').select('id, order_number, email, phone, total_price, currency, financial_status, fulfillment_status, shopify_created_at').eq('store_id', store.id).order('shopify_created_at', { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    store ? service.from('shopify_abandoned_checkouts').select('id, email, phone, total_price, currency, recovery_url, abandoned_at').eq('store_id', store.id).is('completed_at', null).order('abandoned_at', { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
  ])

  const customerCount    = custRes.count ?? 0
  const automations      = (autoRes.data ?? []) as Array<{ type: string; is_enabled: boolean }>
  const activeAutos      = automations.filter(a => a.is_enabled).length
  const orderCount       = orderStatsRes.count ?? 0
  const revenue           = (orderStatsRes.data ?? []).reduce((sum, o) => sum + (o.total_price ?? 0), 0)
  const checkoutCount    = checkoutStatsRes.count ?? 0
  const recoverableValue = (checkoutStatsRes.data ?? []).reduce((sum, c) => sum + (c.total_price ?? 0), 0)
  const productCount     = productRes.count ?? 0
  const recentOrders     = recentOrdersRes.data ?? []
  const recentCheckouts  = recentCheckoutsRes.data ?? []

  const webhookEvents = [
    { event: 'checkouts/create', label: 'Checkout Created', desc: 'Triggers abandoned cart recovery after delay', enabled: true },
    { event: 'checkouts/update', label: 'Checkout Updated', desc: 'Resets abandoned cart timer', enabled: true },
    { event: 'orders/create',    label: 'Order Created',    desc: 'Triggers COD verification + order confirmation', enabled: true },
    { event: 'orders/fulfilled', label: 'Order Fulfilled',  desc: 'Triggers shipping update + upsell + review request', enabled: true },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={20} className="text-[#96bf48]" /> Shopify
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Everything synced from your store, and what to do with it</p>
        </div>
        {store && (
          <div className="flex items-center gap-2">
            {isCustomApp && <ShopifySyncNowButton />}
            <Link href="/dashboard/campaigns"
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm">
              <Megaphone size={15} /> Launch Campaign
            </Link>
          </div>
        )}
      </div>

      {!store ? (
        // Onboarding no longer connects Shopify itself — this is the actual
        // connect moment now, first time someone clicks into Shopify from the
        // sidebar. Matches the Leads page's "Connect Facebook" empty state:
        // centered icon/headline/button, not a slim inline banner easy to
        // miss. Non-owner/admin roles still reach this page (manager has
        // nav access to it) but can't actually connect — api/shopify/install
        // and custom-app/connect both 403 them server-side — so the button
        // itself is swapped for a message instead of a control that would
        // just fail.
        <div className="flex flex-col items-center justify-center text-center gap-5 py-16 px-6">
          <div className="w-16 h-16 bg-[#96bf48]/10 rounded-2xl flex items-center justify-center">
            <ShoppingBag size={32} className="text-[#96bf48]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect your store</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              {canConnect
                ? 'Link your Shopify store to sync orders, abandoned checkouts, and customers — and start messaging them on WhatsApp automatically.'
                : 'Ask your account owner or admin to connect Shopify — orders, abandoned checkouts, and customers will show up here once it’s linked.'}
            </p>
          </div>
          {canConnect && (
            <Link href="/dashboard/integrations"
              className="flex items-center gap-2 px-6 py-3 bg-[#96bf48] hover:bg-[#7da33a] text-white text-sm font-semibold rounded-xl transition active:scale-[0.97]">
              <Link2 size={15} /> Connect Shopify
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Connection summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-[#96bf48]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={20} className="text-[#96bf48]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{store.shop_name ?? store.shopify_domain}</p>
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Connected
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">
                  {store.shopify_domain}{store.updated_at && ` · Last synced ${timeAgo(store.updated_at)}`}
                </p>
              </div>
            </div>
            <Link href="/dashboard/integrations"
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              Manage <ArrowRight size={13} />
            </Link>
          </div>

          {/* Stat cards — mirrors Contacts' stat-card grid exactly. 5 stats
              in a 2-col mobile grid left the last one sitting alone in a
              half-empty row — span it full-width there instead so it reads
              as a deliberate closing row, not a leftover. */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Orders', value: orderCount.toLocaleString(), color: '#6b7280' },
              { label: 'Revenue', value: formatCurrency(revenue), color: '#10b981' },
              { label: 'Abandoned Checkouts', value: checkoutCount.toLocaleString(), color: '#f97316', sub: checkoutCount > 0 ? `${formatCurrency(recoverableValue)} recoverable` : undefined },
              { label: 'Reachable on WhatsApp', value: customerCount.toLocaleString(), color: '#25D366' },
              { label: 'Products', value: productCount.toLocaleString(), color: '#3b82f6' },
            ].map((s, i, arr) => (
              <div key={s.label} className={cn(
                'bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 sm:p-4 min-w-0',
                i === arr.length - 1 && arr.length % 2 === 1 && 'col-span-2 sm:col-span-1',
              )}>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{s.value}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
                {s.sub && <p className="text-[10px] text-emerald-600 font-medium mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Abandoned checkouts + recent orders */}
          {(recentCheckouts.length > 0 || recentOrders.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <ShoppingCart size={15} className="text-orange-500" />
                  <h2 className="font-semibold text-gray-900 text-sm">Abandoned Checkouts</h2>
                </div>
                {recentCheckouts.length === 0 ? (
                  <p className="text-sm text-gray-400 px-5 py-6 text-center">None right now.</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recentCheckouts.map(c => {
                      const key = c.phone ?? c.email ?? c.id
                      return (
                        <div key={c.id} className="flex items-center gap-2.5 px-4 sm:px-5 py-3">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', avatarColor(key))}>
                            {avatarInitials(null, key)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{c.phone ?? c.email ?? 'Unknown'}</p>
                            <p className="text-xs text-gray-400">
                              {c.abandoned_at ? timeAgo(c.abandoned_at) : ''} · {c.currency ?? ''} {c.total_price ?? '—'}
                            </p>
                          </div>
                          {c.phone && (
                            <a
                              href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi! Saw you were checking out — need any help completing your order?')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/5 px-2.5 py-1.5 rounded-lg transition"
                            >
                              <MessageCircle size={12} /> Message
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <Package size={15} className="text-gray-500" />
                  <h2 className="font-semibold text-gray-900 text-sm">Recent Orders</h2>
                </div>
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-400 px-5 py-6 text-center">None synced yet.</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recentOrders.map(o => {
                      const key = o.phone ?? o.email ?? o.id
                      return (
                        <div key={o.id} className="flex items-center gap-2.5 px-4 sm:px-5 py-3">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', avatarColor(key))}>
                            {avatarInitials(null, key)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{o.order_number} · {o.phone ?? o.email ?? 'No contact'}</p>
                            <p className="text-xs text-gray-400">
                              {o.shopify_created_at ? timeAgo(o.shopify_created_at) : ''} · {o.financial_status ?? '—'}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{o.currency ?? ''} {o.total_price ?? '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Automations powered by Shopify */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Zap size={15} className="text-[#25D366]" /> Revenue Automations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[
            { type: 'abandoned_cart',       label: 'Abandoned Cart Recovery',   impact: '15-25% recovery rate' },
            { type: 'cod_verification',      label: 'COD Verification',          impact: 'Reduce RTO by 40%' },
            { type: 'order_confirmation',    label: 'Order Confirmation',        impact: 'Build trust, reduce CS' },
            { type: 'shipping_update',       label: 'Shipping Notifications',    impact: 'Reduce WISMO queries' },
            { type: 'post_purchase_upsell',  label: 'Post-Purchase Upsell',     impact: '+20% repeat purchase' },
            { type: 'review_request',        label: 'Review Request',            impact: 'Boost social proof' },
          ].map(item => {
            const auto = automations.find(a => a.type === item.type)
            const enabled = auto?.is_enabled ?? false
            return (
              <div key={item.type} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-[#25D366]/20 transition">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', enabled ? 'bg-emerald-50' : 'bg-gray-100')}>
                  <Zap size={14} className={enabled ? 'text-emerald-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.impact}</p>
                </div>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0', enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400')}>
                  {enabled ? 'On' : 'Off'}
                </span>
              </div>
            )
          })}
        </div>
        <Link href="/dashboard/automations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline">
          Manage all automations <ArrowRight size={13} />
        </Link>
      </div>

      {/* Webhook events */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Webhook size={15} className="text-gray-500" /> Webhook Events
        </h2>
        <div className="space-y-2">
          {webhookEvents.map(w => (
            <div key={w.event} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{w.label}</p>
                <p className="text-xs text-gray-500">{w.desc}</p>
              </div>
              <code className="text-[10px] font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">
                {w.event}
              </code>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-900 rounded-xl">
          <p className="text-xs text-gray-400 font-mono mb-1">Webhook URL</p>
          <p className="text-xs text-green-400 font-mono break-all">
            {process.env.NEXT_PUBLIC_APP_URL ?? 'https://wapaci.com'}/api/shopify/webhooks
          </p>
        </div>
      </div>
    </div>
  )
}

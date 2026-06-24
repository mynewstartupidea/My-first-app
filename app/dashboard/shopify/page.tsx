export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ShoppingBag, CheckCircle2, AlertCircle, Zap, Users,
  Package, ArrowRight, RefreshCw, Link2, Webhook, BarChart2
} from 'lucide-react'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import { pickPreferredStore } from '@/lib/store-selection'

export default async function ShopifyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: storeRows } = await supabase
    .from('stores').select('*').eq('user_id', user.id).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const preferredStore = pickPreferredStore(storeRows)
  const store = preferredStore?.shopify_domain ? preferredStore : null

  const [custRes, orderRes, autoRes] = await Promise.all([
    store ? supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id) : Promise.resolve({ count: 0 }),
    store ? supabase.from('messages').select('id', { count: 'exact', head: true }).eq('store_id', store.id) : Promise.resolve({ count: 0 }),
    store ? supabase.from('automations').select('type,is_enabled').eq('store_id', store.id) : Promise.resolve({ data: [] }),
  ])

  const customerCount = custRes.count ?? 0
  const messageCount  = orderRes.count ?? 0
  const automations   = (autoRes.data ?? []) as Array<{ type: string; is_enabled: boolean }>
  const activeAutos   = automations.filter(a => a.is_enabled).length

  const webhookEvents = [
    { event: 'checkouts/create', label: 'Checkout Created', desc: 'Triggers abandoned cart recovery after delay', enabled: true },
    { event: 'checkouts/update', label: 'Checkout Updated', desc: 'Resets abandoned cart timer', enabled: true },
    { event: 'orders/create',    label: 'Order Created',    desc: 'Triggers COD verification + order confirmation', enabled: true },
    { event: 'orders/fulfilled', label: 'Order Fulfilled',  desc: 'Triggers shipping update + upsell + review request', enabled: true },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag size={22} className="text-[#96bf48]" /> Shopify Integration
          </h1>
          <p className="text-slate-500 text-sm mt-1">Deep integration with your Shopify store for WhatsApp automation</p>
        </div>
        {!store && (
          <Link href="/dashboard/integrations"
            className="flex items-center gap-2 bg-[#96bf48] hover:bg-[#7da33a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            <Link2 size={15} /> Connect Shopify
          </Link>
        )}
      </div>

      {/* Connection status */}
      {store ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#96bf48]/10 rounded-2xl flex items-center justify-center">
                <ShoppingBag size={22} className="text-[#96bf48]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-base">{store.shop_name ?? store.shopify_domain}</p>
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Connected
                  </span>
                </div>
                {store.shopify_domain && (
                  <p className="text-slate-400 text-sm">{store.shopify_domain}</p>
                )}
                {store.updated_at && (
                  <p className="text-slate-400 text-xs mt-0.5">Last synced {timeAgo(store.updated_at)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
                <RefreshCw size={13} /> Sync Now
              </button>
              <Link href="/dashboard/integrations"
                className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
                Manage <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
            {[
              { label: 'Customers Synced', value: customerCount.toLocaleString(), icon: Users },
              { label: 'Messages Sent', value: messageCount.toLocaleString(), icon: Zap },
              { label: 'Active Automations', value: String(activeAutos), icon: BarChart2 },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-5 flex items-start gap-4">
          <AlertCircle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Shopify store not connected</p>
            <p className="text-amber-600 text-sm mt-1">Connect your store to enable automatic WhatsApp messaging for orders, carts, and shipping updates.</p>
            <Link href="/dashboard/integrations" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-amber-700 hover:text-amber-900">
              Connect Shopify <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Automations powered by Shopify */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={15} className="text-[#25D366]" /> Revenue Automations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[
            { type: 'abandoned_cart',       label: 'Abandoned Cart Recovery',   trigger: 'checkouts/create', impact: '15-25% recovery rate' },
            { type: 'cod_verification',      label: 'COD Verification',          trigger: 'orders/create',    impact: 'Reduce RTO by 40%' },
            { type: 'order_confirmation',    label: 'Order Confirmation',        trigger: 'orders/create',    impact: 'Build trust, reduce CS' },
            { type: 'shipping_update',       label: 'Shipping Notifications',    trigger: 'orders/fulfilled', impact: 'Reduce WISMO queries' },
            { type: 'post_purchase_upsell',  label: 'Post-Purchase Upsell',     trigger: 'orders/fulfilled', impact: '+20% repeat purchase' },
            { type: 'review_request',        label: 'Review Request',            trigger: 'orders/fulfilled', impact: 'Boost social proof' },
          ].map(item => {
            const auto = automations.find(a => a.type === item.type)
            const enabled = auto?.is_enabled ?? false
            return (
              <div key={item.type} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-[#25D366]/20 transition">
                <div className={cn_inline(enabled ? 'bg-emerald-50' : 'bg-slate-100', 'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0')}>
                  <Zap size={14} className={enabled ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.impact}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {enabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <Link href="/dashboard/automations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline">
          Manage all automations <ArrowRight size={13} />
        </Link>
      </div>

      {/* Webhook events */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Webhook size={15} className="text-slate-600" /> Webhook Events
        </h2>
        <div className="space-y-2">
          {webhookEvents.map(w => (
            <div key={w.event} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                <p className="text-xs text-slate-500">{w.desc}</p>
              </div>
              <code className="text-[10px] font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded flex-shrink-0">
                {w.event}
              </code>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-slate-900 rounded-xl">
          <p className="text-xs text-slate-400 font-mono mb-1">Webhook URL</p>
          <p className="text-xs text-green-400 font-mono break-all">
            {process.env.NEXT_PUBLIC_APP_URL ?? 'https://wapaci.com'}/api/shopify/webhooks
          </p>
        </div>
      </div>
    </div>
  )
}

function cn_inline(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

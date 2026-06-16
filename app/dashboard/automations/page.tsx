'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingCart, Package, CheckCircle2, Truck, Loader2, Save,
  AlertCircle, Zap, RefreshCw, Gift, X, Send, Star, Repeat,
  MessageSquare, Clock, TrendingUp, ArrowRight, Plus, Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LiveType = 'abandoned_cart' | 'cod_verification' | 'order_confirmation' | 'shipping_update'
  | 'post_purchase_upsell' | 'win_back' | 'review_request' | 'repeat_purchase'

interface Automation {
  id: string
  store_id: string
  type: LiveType
  is_enabled: boolean
  delay_minutes: number
  template: string
  discount_enabled: boolean
  discount_value: number
}

const LIVE_TYPES: Record<LiveType, {
  icon: React.ElementType; label: string; description: string; impact: string;
  color: string; bg: string; trigger: string; defaultDelay: number; defaultTemplate: string;
}> = {
  abandoned_cart: {
    icon: ShoppingCart, label: 'Abandoned Cart Recovery',
    description: 'Send a reminder when a customer adds to cart but doesn\'t complete checkout.',
    impact: 'Recovers 15–25% of abandoned carts',
    color: 'text-orange-600', bg: 'bg-orange-50',
    trigger: 'checkouts/create',
    defaultDelay: 30,
    defaultTemplate: 'Hi {{name}}! 👋 You left something in your cart at {{shop_name}}.\n\nYour items are waiting! Complete your purchase here:\n{{cart_url}}\n\nHurry — items may sell out!',
  },
  cod_verification: {
    icon: Package, label: 'COD Verification',
    description: 'Ask customers to confirm COD orders before dispatch to reduce RTO.',
    impact: 'Reduces RTO by up to 40%',
    color: 'text-purple-600', bg: 'bg-purple-50',
    trigger: 'orders/create (COD)',
    defaultDelay: 5,
    defaultTemplate: 'Hi {{name}}! 🛍️ Your COD order #{{order_number}} for ₹{{amount}} at {{shop_name}} is confirmed.\n\nPlease reply *YES* to confirm or *NO* to cancel before dispatch.\n\nThank you!',
  },
  order_confirmation: {
    icon: CheckCircle2, label: 'Order Confirmation',
    description: 'Send an instant WhatsApp confirmation when an order is placed.',
    impact: 'Reduces customer support queries',
    color: 'text-emerald-600', bg: 'bg-emerald-50',
    trigger: 'orders/create',
    defaultDelay: 0,
    defaultTemplate: 'Hi {{name}}! 🎉 Your order #{{order_number}} is confirmed at {{shop_name}}.\n\nWe\'ll send you shipping details soon. Track your order:\n{{order_url}}\n\nThank you for shopping with us!',
  },
  shipping_update: {
    icon: Truck, label: 'Shipping Update',
    description: 'Notify customers via WhatsApp when their order is shipped with tracking.',
    impact: 'Reduces WISMO queries by 60%',
    color: 'text-blue-600', bg: 'bg-blue-50',
    trigger: 'orders/fulfilled',
    defaultDelay: 0,
    defaultTemplate: 'Hi {{name}}! 📦 Your order #{{order_number}} from {{shop_name}} has been shipped!\n\nTrack your delivery:\n{{tracking_url}}\n\nExpected delivery in 3–5 business days.',
  },
  post_purchase_upsell: {
    icon: TrendingUp, label: 'Post-Purchase Upsell',
    description: 'Send a personalized product recommendation 24h after order delivery.',
    impact: 'Increases repeat purchase by 20%',
    color: 'text-pink-600', bg: 'bg-pink-50',
    trigger: 'orders/fulfilled + 24h delay',
    defaultDelay: 1440,
    defaultTemplate: 'Hi {{name}}! ❤️ Thank you for your order at {{shop_name}}!\n\nCustomers who bought this also loved these products. Check them out:\n[PRODUCT_LINK]\n\nUse code THANKYOU10 for 10% off your next order!',
  },
  win_back: {
    icon: Repeat, label: 'Win-back Campaign',
    description: 'Re-engage customers who haven\'t ordered in 45+ days with a special offer.',
    impact: 'Recovers 12% of inactive customers',
    color: 'text-red-600', bg: 'bg-red-50',
    trigger: 'Nightly scan (inactive 45+ days)',
    defaultDelay: 0,
    defaultTemplate: 'Hi {{name}}! 👋 We miss you at {{shop_name}}!\n\nIt\'s been a while since your last order. Here\'s a special gift — 15% off just for you:\n\nCode: COMEBACK15\nShop now: [SHOP_LINK]\n\nValid for 48 hours only!',
  },
  review_request: {
    icon: Star, label: 'Review Request',
    description: 'Ask customers for a review 5 days after their order is delivered.',
    impact: 'Boosts social proof & conversions',
    color: 'text-amber-600', bg: 'bg-amber-50',
    trigger: 'orders/fulfilled + 5d delay',
    defaultDelay: 7200,
    defaultTemplate: 'Hi {{name}}! 😊 Hope you\'re loving your purchase from {{shop_name}}!\n\nWould you mind leaving us a quick review? It takes just 2 minutes and really helps us:\n[REVIEW_LINK]\n\nThank you so much!',
  },
  repeat_purchase: {
    icon: Gift, label: 'Repeat Purchase Reminder',
    description: 'Remind customers to reorder based on average order cycle.',
    impact: 'Increases LTV by 30%',
    color: 'text-indigo-600', bg: 'bg-indigo-50',
    trigger: 'Scheduled based on order history',
    defaultDelay: 43200,
    defaultTemplate: 'Hi {{name}}! 🔁 Running low on your favourites from {{shop_name}}?\n\nTime to restock! Shop your previous items:\n[SHOP_LINK]\n\nUse code REPEAT10 for 10% off!',
  },
}

const COMING_SOON = [
  { icon: Tag,          label: 'Browse Abandonment',    desc: 'Send when customer browses but doesn\'t add to cart',         soon: 'Q3 2025' },
  { icon: TrendingUp,   label: 'Price Drop Alert',       desc: 'Notify wishlist customers when product price drops',          soon: 'Q3 2025' },
  { icon: Package,      label: 'Back in Stock Alert',    desc: 'Alert customers when out-of-stock product is available',      soon: 'Q3 2025' },
  { icon: MessageSquare,label: 'Welcome Series',         desc: 'Multi-message welcome flow for new customers',               soon: 'Q3 2025' },
  { icon: Clock,        label: 'Replenishment Reminder', desc: 'Remind customers to reorder consumable products',             soon: 'Q4 2025' },
  { icon: Star,         label: 'VIP Milestone',          desc: 'Celebrate customer milestones and reward loyalty',            soon: 'Q4 2025' },
  { icon: Repeat,       label: 'Cross-sell Campaign',    desc: 'Suggest complementary products after purchase',               soon: 'Q4 2025' },
]

function AutomationCard({
  type, meta, automation, onSave,
}: {
  type: LiveType
  meta: typeof LIVE_TYPES[LiveType]
  automation: Automation | null
  onSave: (data: Partial<Automation> & { type: LiveType }) => Promise<void>
}) {
  const [expanded, setExpanded]           = useState(false)
  const [enabled, setEnabled]             = useState(automation?.is_enabled ?? false)
  const [delay, setDelay]                 = useState(automation?.delay_minutes ?? meta.defaultDelay)
  const [template, setTemplate]           = useState(automation?.template ?? meta.defaultTemplate)
  const [discountEnabled, setDiscountEnabled] = useState(automation?.discount_enabled ?? false)
  const [discountValue, setDiscountValue] = useState(automation?.discount_value ?? 10)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)

  async function save() {
    setSaving(true)
    await onSave({ type, is_enabled: enabled, delay_minutes: delay, template, discount_enabled: discountEnabled, discount_value: discountValue })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Icon = meta.icon

  return (
    <div className={cn('bg-white rounded-2xl border-2 shadow-sm transition-all',
      enabled ? 'border-[#25D366]/30' : 'border-slate-100')}>
      {/* Card header */}
      <div className="flex items-center gap-4 p-5">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
          <Icon size={18} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{meta.label}</p>
            {enabled && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{meta.description}</p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock size={10} /> {meta.trigger}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-medium">
            <TrendingUp size={11} /> {meta.impact}
          </div>
          {/* Toggle */}
          <button onClick={() => setEnabled(v => !v)}
            className={cn('relative h-6 w-11 rounded-full transition-colors flex-shrink-0', enabled ? 'bg-[#25D366]' : 'bg-slate-200')}>
            <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all', enabled ? 'left-6' : 'left-1')} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100">
            {expanded ? <X size={15} /> : <Plus size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          {/* Delay */}
          {meta.defaultDelay > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Send Delay</label>
              <div className="flex items-center gap-2">
                <input type="number" value={delay} min={0} onChange={e => setDelay(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 font-mono" />
                <span className="text-sm text-slate-500">minutes</span>
                <span className="text-xs text-slate-400">({delay >= 60 ? `${Math.round(delay / 60)}h` : `${delay}m`} after trigger)</span>
              </div>
            </div>
          )}

          {/* Discount */}
          {type === 'abandoned_cart' && (
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" checked={discountEnabled} onChange={e => setDiscountEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-[#25D366] focus:ring-[#25D366]" />
                Include discount code
              </label>
              {discountEnabled && (
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" value={discountValue} min={1} max={100} onChange={e => setDiscountValue(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 font-mono" />
                  <span className="text-sm text-slate-500">% off</span>
                </div>
              )}
            </div>
          )}

          {/* Template */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Message Template</label>
              <button onClick={() => setTemplate(meta.defaultTemplate)}
                className="text-[11px] text-[#25D366] hover:underline">Reset to default</button>
            </div>
            <textarea rows={5} value={template} onChange={e => setTemplate(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 resize-none font-mono leading-relaxed" />
            <p className="text-[10px] text-slate-400 mt-1">
              Variables: {'{{name}}'} {'{{shop_name}}'} {'{{order_number}}'} {'{{cart_url}}'} {'{{tracking_url}}'}
            </p>
          </div>

          {/* Preview */}
          <div className="bg-[#e5ddd5] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Preview</p>
            <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[85%] shadow-sm">
              <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                {template.replace(/\{\{name\}\}/g, 'Priya').replace(/\{\{shop_name\}\}/g, 'Your Store')
                  .replace(/\{\{order_number\}\}/g, '#1234').replace(/\{\{amount\}\}/g, '₹1,299')
                  .replace(/\{\{cart_url\}\}/g, 'yourstore.com/cart').replace(/\{\{tracking_url\}\}/g, 'track.link/xyz')}
              </p>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]         = useState(true)
  const [hasStore, setHasStore]       = useState(true)
  const [storeId, setStoreId]         = useState<string | null>(null)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: store } = await supabase.from('stores').select('id').eq('user_id', user.id)
      .eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (!store) { setHasStore(false); setLoading(false); return }
    setStoreId(store.id); setHasStore(true)
    const { data } = await supabase.from('automations').select('*').eq('store_id', store.id)
    setAutomations(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave(data: Partial<Automation> & { type: LiveType }) {
    if (!storeId) return
    const existing = automations.find(a => a.type === data.type)
    let error: unknown = null
    if (existing) {
      const res = await supabase.from('automations').update(data).eq('id', existing.id)
      error = res.error
    } else {
      const res = await supabase.from('automations').insert({ ...data, store_id: storeId, template: data.template ?? '' })
      error = res.error
    }
    if (error) { showToast('Failed to save', false); return }
    showToast('Saved successfully!')
    await load()
  }

  const activeCount = automations.filter(a => a.is_enabled).length

  return (
    <div className="p-6 lg:p-8">
      {toast && (
        <div className={cn('fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white')}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeCount > 0
              ? `${activeCount} automation${activeCount > 1 ? 's' : ''} running — recovering revenue 24/7`
              : 'Set up automations to start recovering revenue automatically'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Revenue impact banner */}
      {activeCount === 0 && (
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-white">Enable automations to recover revenue while you sleep</p>
            <p className="text-green-100 text-sm mt-0.5">Merchants with 3+ automations see avg. ₹25,000/month in recovered revenue.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-[#25D366]" /></div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <AlertCircle size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your Shopify store first</p>
          <p className="text-amber-600 text-sm mt-1">Automations trigger from Shopify webhooks.</p>
        </div>
      ) : (
        <>
          {/* Live automations */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Live Automations
            </h2>
            <div className="space-y-3">
              {(Object.keys(LIVE_TYPES) as LiveType[]).map(type => (
                <AutomationCard
                  key={type}
                  type={type}
                  meta={LIVE_TYPES[type]}
                  automation={automations.find(a => a.type === type) ?? null}
                  onSave={handleSave}
                />
              ))}
            </div>
          </div>

          {/* Coming soon */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock size={13} className="text-slate-400" /> Coming Soon
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {COMING_SOON.map(cs => (
                <div key={cs.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 opacity-70">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <cs.icon size={16} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{cs.label}</p>
                    <p className="text-xs text-slate-400 truncate">{cs.desc}</p>
                  </div>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-full flex-shrink-0">{cs.soon}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

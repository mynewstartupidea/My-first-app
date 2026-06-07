'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingCart, Package, CheckCircle2, Truck,
  Loader2, Save, AlertCircle, Info, Zap,
  Star, RefreshCw, Gift, Plus, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Automation, AutomationType, Store } from '@/types'

type LiveType = 'abandoned_cart' | 'cod_verification' | 'order_confirmation' | 'shipping_update'

// ─── Live automations backed by DB ────────────────────────────────────────────

const LIVE_AUTOMATION_META: Record<LiveType, {
  icon: React.ElementType
  label: string
  description: string
  color: string
  bg: string
  whenText: string
}> = {
  abandoned_cart: {
    icon: ShoppingCart,
    label: 'Abandoned Cart Recovery',
    description: 'Send a WhatsApp reminder when a customer adds items to cart but doesn\'t complete checkout.',
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    whenText: 'Triggers X minutes after cart is abandoned',
  },
  cod_verification: {
    icon: Package,
    label: 'COD Confirmation',
    description: 'Ask customers to confirm their COD order via WhatsApp before dispatch — reduces RTO by up to 40%.',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    whenText: 'Triggers when a COD order is placed',
  },
  order_confirmation: {
    icon: CheckCircle2,
    label: 'Order Status Notification',
    description: 'Send an instant WhatsApp confirmation when a customer places an order.',
    color: 'text-green-600',
    bg: 'bg-green-100',
    whenText: 'Triggers immediately on order placement',
  },
  shipping_update: {
    icon: Truck,
    label: 'Shipping Update',
    description: 'Notify customers via WhatsApp when their order has been shipped with tracking details.',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    whenText: 'Triggers when order is marked as shipped',
  },
}

// ─── Preview/upcoming automations (UI only, not yet in DB) ────────────────────

const PREVIEW_AUTOMATIONS: {
  key: string
  icon: React.ElementType
  label: string
  description: string
  color: string
  bg: string
  comingSoon?: boolean
}[] = [
  {
    key: 'post_purchase_upsell',
    icon: Gift,
    label: 'Post-Purchase Upsell',
    description: 'Automatically send a personalised upsell offer to customers after they receive their order — the perfect moment to cross-sell.',
    color: 'text-pink-600',
    bg: 'bg-pink-100',
  },
  {
    key: 'win_back',
    icon: RefreshCw,
    label: 'Win-Back Campaign',
    description: 'Re-engage customers who haven\'t ordered in 60+ days with a personalised discount offer.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
  {
    key: 'review_request',
    icon: Star,
    label: 'Review Request',
    description: 'Ask satisfied customers for a product review a few days after delivery — boost your store rating automatically.',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
  },
  {
    key: 'repeat_purchase',
    icon: Zap,
    label: 'Repeat Purchase Reminder',
    description: 'Remind customers when it\'s time to reorder a consumable product based on their purchase history.',
    color: 'text-teal-600',
    bg: 'bg-teal-100',
    comingSoon: true,
  },
]

const TEMPLATE_VARS: Record<LiveType, string[]> = {
  abandoned_cart:    ['{{name}}', '{{shop_name}}', '{{cart_url}}', '{{discount_code}}', '{{discount_value}}'],
  cod_verification:  ['{{name}}', '{{order_number}}', '{{amount}}', '{{shop_name}}'],
  order_confirmation:['{{name}}', '{{order_number}}', '{{shop_name}}', '{{order_url}}'],
  shipping_update:   ['{{name}}', '{{order_number}}', '{{shop_name}}', '{{tracking_url}}'],
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  abandoned_cart:     'Hi {{name}}! You left something behind 🛒\n\nYour cart at {{shop_name}} is waiting for you. Complete your order now → {{cart_url}}',
  cod_verification:   'Hi {{name}}! Please confirm your COD order #{{order_number}} for ₹{{amount}} at {{shop_name}}.\n\nReply YES to confirm or NO to cancel.',
  order_confirmation: 'Hi {{name}}! Your order #{{order_number}} has been confirmed at {{shop_name}} ✅\n\nTrack your order → {{order_url}}',
  shipping_update:    'Hi {{name}}! Your order #{{order_number}} from {{shop_name}} has been shipped 🚚\n\nTrack it here → {{tracking_url}}',
  post_purchase_upsell: 'Hi {{name}}! Thank you for your order at {{shop_name}} ❤️\n\nCustomers who bought this also loved — [PRODUCT_LINK]\n\nUse code THANKYOU10 for 10% off your next order!',
  win_back:           'Hi {{name}}! We miss you at {{shop_name}} 💚\n\nIt\'s been a while since your last visit. Here\'s 15% off your next order → [SHOP_LINK]\n\nCode: COMEBACK15 (48 hrs only)',
  review_request:     'Hi {{name}}! Hope you\'re loving your purchase from {{shop_name}} 😊\n\nWould you mind leaving us a quick review? It helps us a lot → [REVIEW_LINK]',
  repeat_purchase:    'Hi {{name}}! Time to restock? 🔄\n\nBased on your purchase history, your supply from {{shop_name}} might be running low. Order now → [SHOP_LINK]',
}

// ─── Create Automation modal ───────────────────────────────────────────────────

function CreateAutomationModal({ storeId, onClose, onCreated }: {
  storeId: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const supabase = useMemo(() => createClient(), [])

  const options = [
    ...Object.entries(LIVE_AUTOMATION_META).map(([key, meta]) => ({ key, ...meta })),
    ...PREVIEW_AUTOMATIONS,
  ]

  const isLiveType = (key: string): key is AutomationType =>
    key in LIVE_AUTOMATION_META

  async function handleCreate() {
    if (!selected || !storeId) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.from('automations').upsert({
      store_id:         storeId,
      type:             selected,
      is_enabled:       true,
      template:         DEFAULT_TEMPLATES[selected] ?? '',
      delay_minutes:    selected === 'abandoned_cart' ? 30 : selected === 'cod_verification' ? 5 : 0,
      discount_enabled: false,
      discount_value:   10,
    }, { onConflict: 'store_id,type' })

    setLoading(false)
    if (err) { setError(err.message); return }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Automation</h2>
            <p className="text-slate-500 text-sm mt-0.5">Choose an automation type to get started</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {options.map(opt => {
            const Icon = opt.icon
            const isSel = selected === opt.key
            const isComing = (opt as { comingSoon?: boolean }).comingSoon
            return (
              <button
                key={opt.key}
                onClick={() => !isComing && setSelected(opt.key)}
                disabled={!!isComing}
                className={cn(
                  'w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition',
                  isComing ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50' :
                  isSel ? 'border-[#25D366] bg-[#25D366]/5' :
                  'border-transparent bg-slate-50 hover:bg-slate-100'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', opt.bg)}>
                  <Icon className={cn('w-5 h-5', opt.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{opt.label}</p>
                    {isComing && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Coming soon</span>
                    )}
                    {!isComing && !isLiveType(opt.key) && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Available</span>
                    )}
                    {isSel && (
                      <CheckCircle2 className="w-4 h-4 text-[#25D366] ml-auto flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{opt.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || loading || !storeId}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Creating…' : 'Create & Enable'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [store, setStore]             = useState<Store | null>(null)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState<string | null>(null)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [edited, setEdited]           = useState<Record<string, Partial<Automation>>>({})
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [showCreate, setShowCreate]   = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: storeData } = await supabase
      .from('stores').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    setStore(storeData)

    if (storeData) {
      const { data: autos } = await supabase
        .from('automations').select('*').eq('store_id', storeData.id)
      setAutomations(autos ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function toggleAutomation(automation: Automation) {
    const newVal = !automation.is_enabled
    setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, is_enabled: newVal } : a))
    const { error } = await supabase
      .from('automations').update({ is_enabled: newVal, updated_at: new Date().toISOString() }).eq('id', automation.id)
    if (error) {
      setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, is_enabled: !newVal } : a))
      showToast('Failed to update automation', false)
    } else {
      showToast(newVal ? 'Automation enabled!' : 'Automation disabled')
    }
  }

  async function saveAutomation(automation: Automation) {
    const changes = edited[automation.id]
    if (!changes) return
    setSaving(automation.id)
    const { error } = await supabase
      .from('automations')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', automation.id)
    setSaving(null)
    if (error) { showToast('Failed to save changes', false); return }
    setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, ...changes } : a))
    setEdited(prev => { const n = { ...prev }; delete n[automation.id]; return n })
    showToast('Changes saved!')
    setExpanded(null)
  }

  function updateField(id: string, field: keyof Automation, value: unknown) {
    setEdited(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  function getVal<K extends keyof Automation>(id: string, field: K, fallback: Automation[K]): Automation[K] {
    return (edited[id]?.[field] as Automation[K]) ?? fallback
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Create automation modal */}
      {showCreate && (
        <CreateAutomationModal
          storeId={store?.id ?? null}
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadData(); showToast('Automation created and enabled!') }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enable WhatsApp automations to recover revenue and improve customer experience automatically.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-green-500/20"
        >
          <Plus className="w-4 h-4" /> Create Automation
        </button>
      </div>

      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Connect your store first</p>
            <p className="text-amber-700 text-sm mt-0.5">Go to Settings or Integrations to connect your ecommerce store and enable automations.</p>
          </div>
        </div>
      )}

      {automations.length === 0 && store && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-blue-800 text-sm">Default automations are being created for your store. Refresh in a moment.</p>
        </div>
      )}

      {/* ── Live automations ────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Live Automations</h2>
        <div className="space-y-4">
          {(Object.keys(LIVE_AUTOMATION_META) as LiveType[]).map(type => {
            const meta  = LIVE_AUTOMATION_META[type]
            const auto  = automations.find(a => a.type === type)
            const isExp = expanded === type
            const Icon  = meta.icon

            if (!auto) {
              return (
                <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 opacity-50">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                      <Icon className={cn('w-5 h-5', meta.color)} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{meta.label}</p>
                      <p className="text-slate-400 text-xs">Connect your store to enable</p>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-5">
                  <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', auto.is_enabled ? meta.bg : 'bg-slate-100')}>
                    <Icon className={cn('w-5 h-5', auto.is_enabled ? meta.color : 'text-slate-400')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{meta.label}</p>
                      {auto.is_enabled && (
                        <span className="flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5 leading-snug">{meta.description}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleAutomation(auto)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                        auto.is_enabled ? 'bg-[#25D366]' : 'bg-slate-200'
                      )}
                      aria-label="Toggle automation"
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        auto.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                    <button
                      onClick={() => setExpanded(isExp ? null : type)}
                      className="text-sm text-slate-500 hover:text-[#25D366] font-medium transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
                    >
                      {isExp ? 'Close' : 'Configure'}
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(type === 'abandoned_cart' || type === 'cod_verification') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Delay after trigger (minutes)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={getVal(auto.id, 'delay_minutes', auto.delay_minutes)}
                            onChange={e => updateField(auto.id, 'delay_minutes', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                          />
                          <p className="text-slate-400 text-xs mt-1">{meta.whenText}</p>
                        </div>
                      )}
                      {type === 'abandoned_cart' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Discount incentive</label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateField(auto.id, 'discount_enabled', !getVal(auto.id, 'discount_enabled', auto.discount_enabled))}
                              className={cn(
                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                getVal(auto.id, 'discount_enabled', auto.discount_enabled) ? 'bg-[#25D366]' : 'bg-slate-200'
                              )}
                            >
                              <span className={cn(
                                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                                getVal(auto.id, 'discount_enabled', auto.discount_enabled) ? 'translate-x-6' : 'translate-x-1'
                              )} />
                            </button>
                            <span className="text-sm text-slate-600">Include discount code</span>
                          </div>
                          {getVal(auto.id, 'discount_enabled', auto.discount_enabled) && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={getVal(auto.id, 'discount_value', auto.discount_value)}
                                onChange={e => updateField(auto.id, 'discount_value', parseInt(e.target.value))}
                                className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                              />
                              <span className="text-slate-600 text-sm">% off</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-medium text-slate-700">Message Template</label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {TEMPLATE_VARS[type].map(v => (
                            <span key={v} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">{v}</span>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={getVal(auto.id, 'template', auto.template) as string}
                        onChange={e => updateField(auto.id, 'template', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white resize-none font-mono"
                      />
                      <p className="text-slate-400 text-xs mt-1">Use variable tags in your message — they will be replaced automatically.</p>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setExpanded(null); setEdited(prev => { const n = { ...prev }; delete n[auto.id]; return n }) }}
                        className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveAutomation(auto)}
                        disabled={saving === auto.id || !edited[auto.id]}
                        className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
                      >
                        {saving === auto.id
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                          : <><Save className="w-3.5 h-3.5" /> Save Changes</>
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming automations ────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">More Automation Flows</h2>
        <div className="space-y-3">
          {PREVIEW_AUTOMATIONS.map(auto => {
            const Icon = auto.icon
            return (
              <div key={auto.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-4">
                  <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', auto.bg)}>
                    <Icon className={cn('w-5 h-5', auto.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{auto.label}</p>
                      {auto.comingSoon ? (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Coming soon</span>
                      ) : (
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Available</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5 leading-snug">{auto.description}</p>
                  </div>
                  <button
                    onClick={() => !auto.comingSoon && setShowCreate(true)}
                    disabled={!!auto.comingSoon}
                    className={cn(
                      'text-sm font-medium transition px-3 py-1.5 rounded-lg flex-shrink-0',
                      auto.comingSoon
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-[#25D366] hover:bg-green-50'
                    )}
                  >
                    {auto.comingSoon ? 'Soon' : 'Enable'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-5 flex items-start gap-4">
        <Zap className="w-5 h-5 text-[#25D366] mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Pro tip: Start with COD Confirmation</p>
          <p className="text-green-700 text-sm mt-1">
            Stores lose ₹150–400 per RTO. A single WhatsApp confirmation before dispatch can reduce your RTO rate by 30–40%, paying for itself immediately.
          </p>
        </div>
      </div>
    </div>
  )
}

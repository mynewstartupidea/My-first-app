'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingCart, Package, CheckCircle2, Truck,
  Loader2, Save, AlertCircle, Info, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Automation, AutomationType, Store } from '@/types'

const AUTOMATION_META: Record<AutomationType, {
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
    label: 'COD Order Verification',
    description: 'Ask customers to confirm their COD order via WhatsApp before you dispatch — reduces RTO by up to 40%.',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    whenText: 'Triggers when a COD order is placed',
  },
  order_confirmation: {
    icon: CheckCircle2,
    label: 'Order Confirmation',
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

const TEMPLATE_VARS: Record<AutomationType, string[]> = {
  abandoned_cart:    ['{{name}}', '{{shop_name}}', '{{cart_url}}', '{{discount_code}}', '{{discount_value}}'],
  cod_verification:  ['{{name}}', '{{order_number}}', '{{amount}}', '{{shop_name}}'],
  order_confirmation:['{{name}}', '{{order_number}}', '{{shop_name}}', '{{order_url}}'],
  shipping_update:   ['{{name}}', '{{order_number}}', '{{shop_name}}', '{{tracking_url}}'],
}

export default function AutomationsPage() {
  const [store, setStore]           = useState<Store | null>(null)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [edited, setEdited]         = useState<Record<string, Partial<Automation>>>({})
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const supabase = createClient()

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
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
        <p className="text-slate-500 text-sm mt-1">
          Enable WhatsApp automations to recover revenue and improve customer experience automatically.
        </p>
      </div>

      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Connect your Shopify store first</p>
            <p className="text-amber-700 text-sm mt-0.5">Go to Settings → Connect Shopify to enable automations.</p>
          </div>
        </div>
      )}

      {automations.length === 0 && store && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-blue-800 text-sm">Default automations are being created for your store. Refresh in a moment.</p>
        </div>
      )}

      <div className="space-y-4">
        {(Object.keys(AUTOMATION_META) as AutomationType[]).map(type => {
          const meta  = AUTOMATION_META[type]
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
              {/* Card header */}
              <div className="flex items-center gap-4 p-5">
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', auto.is_enabled ? meta.bg : 'bg-slate-100')}>
                  <Icon className={cn('w-5 h-5', auto.is_enabled ? meta.color : 'text-slate-400')} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800">{meta.label}</p>
                    {auto.is_enabled && (
                      <span className="flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5 leading-snug">{meta.description}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Toggle */}
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

              {/* Expanded config */}
              {isExp && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Delay (not for order/shipping) */}
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

                    {/* Discount toggle (abandoned cart only) */}
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

                  {/* Template */}
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
                    <p className="text-slate-400 text-xs mt-1">Use the variable tags above in your message. They will be replaced automatically.</p>
                  </div>

                  {/* Save */}
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

      {/* Info banner */}
      <div className="mt-8 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-5 flex items-start gap-4">
        <Zap className="w-5 h-5 text-[#25D366] mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Pro tip: Start with COD Verification</p>
          <p className="text-green-700 text-sm mt-1">
            Indian stores lose ₹150–400 per RTO. A single WhatsApp confirmation before dispatch can reduce your RTO rate by 30–40%, paying for itself immediately.
          </p>
        </div>
      </div>
    </div>
  )
}

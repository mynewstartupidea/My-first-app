'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Store, MessageCircle, Loader2, Save, CheckCircle2,
  AlertCircle, ExternalLink, Trash2, Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store as StoreType } from '@/types'

const BSP_OPTIONS = [
  { value: 'mock',     label: 'Mock (Testing)',  desc: 'Messages are logged, not sent' },
  { value: 'interakt', label: 'Interakt',         desc: 'Recommended for India' },
  { value: 'gupshup',  label: 'Gupshup',          desc: 'Largest BSP in India' },
]

export default function SettingsPage() {
  const [store, setStore]               = useState<StoreType | null>(null)
  const [loading, setLoading]           = useState(true)
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [connecting, setConnecting]     = useState(false)
  const [savingWA, setSavingWA]         = useState(false)
  const [waNumber, setWaNumber]         = useState('')
  const [waBsp, setWaBsp]               = useState('mock')
  const [waApiKey, setWaApiKey]         = useState('')
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [userEmail, setUserEmail]       = useState('')
  const supabase = createClient()

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserEmail(user.email ?? '')
    const { data: s } = await supabase
      .from('stores').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (s) {
      setStore(s)
      setWaNumber(s.whatsapp_number ?? '')
      setWaBsp(s.whatsapp_bsp ?? 'mock')
      setWaApiKey(s.whatsapp_api_key ?? '')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function handleConnectShopify() {
    if (!shopifyDomain.trim()) return
    let domain = shopifyDomain.trim().toLowerCase()
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`
    setConnecting(true)
    window.location.href = `/api/shopify/install?shop=${domain}`
  }

  async function saveWhatsApp() {
    if (!store) return
    setSavingWA(true)
    const { error } = await supabase
      .from('stores')
      .update({
        whatsapp_number:  waNumber,
        whatsapp_bsp:     waBsp,
        whatsapp_api_key: waApiKey || null,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', store.id)
    setSavingWA(false)
    if (error) { showToast('Failed to save settings', false); return }
    setStore(prev => prev ? { ...prev, whatsapp_number: waNumber, whatsapp_bsp: waBsp } : prev)
    showToast('WhatsApp settings saved!')
  }

  async function disconnectStore() {
    if (!store) return
    if (!confirm(`Disconnect ${store.shop_name}? All automations will stop.`)) return
    await supabase.from('stores').update({ is_active: false }).eq('id', store.id)
    setStore(null)
    showToast('Store disconnected')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
    </div>
  )

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-3xl">
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
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your store and WhatsApp connection</p>
      </div>

      {/* Account */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-slate-500" />
          </div>
          Account
        </h2>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold">
            {userEmail[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-medium text-slate-800">{userEmail}</p>
            <p className="text-slate-400 text-xs">Account email</p>
          </div>
        </div>
      </section>

      {/* Shopify store */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-green-600" />
          </div>
          Shopify Store
        </h2>

        {store ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">{store.shop_name}</p>
                  <p className="text-green-600 text-sm">{store.shopify_domain}</p>
                </div>
              </div>
              <a
                href={`https://${store.shopify_domain}/admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-100 transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <button
              onClick={disconnectStore}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect store
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-blue-700 text-sm">
                You need a <a href="https://partners.shopify.com" target="_blank" className="font-medium underline">Shopify Partner account</a> and an app created with the correct scopes before connecting.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Shopify store domain</label>
              <div className="flex gap-2">
                <input
                  value={shopifyDomain}
                  onChange={e => setShopifyDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <button
                  onClick={handleConnectShopify}
                  disabled={connecting || !shopifyDomain.trim()}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* WhatsApp config */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
          </div>
          WhatsApp Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">BSP Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {BSP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWaBsp(opt.value)}
                  className={cn(
                    'text-left p-3 rounded-xl border-2 transition',
                    waBsp === opt.value
                      ? 'border-[#25D366] bg-[#25D366]/5'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <p className={cn('text-sm font-medium', waBsp === opt.value ? 'text-[#25D366]' : 'text-slate-700')}>{opt.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Phone Number</label>
            <input
              value={waNumber}
              onChange={e => setWaNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          {waBsp !== 'mock' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key / Token</label>
              <input
                type="password"
                value={waApiKey}
                onChange={e => setWaApiKey(e.target.value)}
                placeholder="Your BSP API key"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
          )}

          <button
            onClick={saveWhatsApp}
            disabled={savingWA || !store}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            {savingWA
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save WhatsApp Settings</>
            }
          </button>
          {!store && <p className="text-slate-400 text-xs">Connect your Shopify store first to save settings.</p>}
        </div>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Current Plan</h2>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div>
            <p className="font-semibold text-slate-800 capitalize">{store?.plan ?? 'Starter'} Plan</p>
            <p className="text-slate-500 text-sm">1,000 conversations/month included</p>
          </div>
          <span className="text-xs bg-[#25D366]/10 text-[#25D366] font-semibold px-3 py-1.5 rounded-full uppercase">
            {store?.plan ?? 'Starter'}
          </span>
        </div>
      </section>
    </div>
  )
}

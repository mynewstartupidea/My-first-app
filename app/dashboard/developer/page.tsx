'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Code2, Key, Webhook, Copy, Eye, EyeOff, CheckCircle2,
  Plus, AlertCircle, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

const WEBHOOK_DOCS = [
  { event: 'message.sent',      desc: 'Fired when a WhatsApp message is sent' },
  { event: 'message.delivered', desc: 'Fired when message is delivered to phone' },
  { event: 'message.read',      desc: 'Fired when customer reads the message' },
  { event: 'cart.recovered',    desc: 'Fired when abandoned cart is recovered' },
  { event: 'order.confirmed',   desc: 'Fired when COD order is confirmed' },
]

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://wapaci.com'

export default function DeveloperPage() {
  const [showKey, setShowKey]     = useState(false)
  const [copied, setCopied]       = useState<string | null>(null)
  const [apiKey, setApiKey]       = useState('')
  const [storeId, setStoreId]     = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    const id = store?.id ?? user.id
    setStoreId(store?.id ?? null)
    // Derive a stable key from the store/user ID — same ID always produces the same key
    setApiKey(`wap_live_${id.replace(/-/g, '').slice(0, 24)}`)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const endpoints = [
    { method: 'POST', path: '/api/whatsapp/test',  desc: 'Send a test WhatsApp message' },
    { method: 'POST', path: '/api/campaigns/send', desc: 'Trigger a campaign broadcast' },
    { method: 'GET',  path: '/api/billing/status', desc: 'Get current billing status and usage' },
    { method: 'GET',  path: '/api/cron',           desc: 'Process pending automation jobs (cron)' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Code2 size={22} className="text-slate-700" /> Developer
        </h1>
        <p className="text-slate-500 text-sm mt-1">API keys, webhooks, and integration documentation</p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Key size={15} className="text-slate-600" /> API Key
        </h2>
        <p className="text-slate-500 text-xs mb-4">Use this key to authenticate API requests. Keep it secret.</p>

        <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-3">
          <code className="flex-1 text-xs font-mono text-green-400 truncate">
            {showKey ? apiKey : `wap_live_${'•'.repeat(16)}`}
          </code>
          <button onClick={() => setShowKey(!showKey)} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={() => copy(apiKey, 'apikey')} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
            {copied === 'apikey' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition">
            <RefreshCw size={11} /> Rotate Key
          </button>
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <AlertCircle size={11} /> Never expose in client-side code
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Webhook size={15} className="text-slate-600" /> Webhook Endpoints
        </h2>
        <p className="text-slate-500 text-xs mb-4">Register these URLs in the respective platforms</p>

        <div className="space-y-3">
          {[
            { label: 'Shopify Webhooks',   url: `${BASE_URL}/api/shopify/webhooks`,  note: 'checkouts/create, orders/create, orders/fulfilled' },
            { label: 'Meta WhatsApp',      url: `${BASE_URL}/api/meta/webhook`,       note: 'messages, message_deliveries, message_reads' },
            { label: 'Razorpay Payments',  url: `${BASE_URL}/api/razorpay/webhook`,   note: 'subscription.charged, subscription.cancelled' },
            { label: 'Vercel Cron',        url: `${BASE_URL}/api/cron`,               note: 'Every 1 minute — processes automation queue' },
          ].map(w => (
            <div key={w.label} className="rounded-xl bg-slate-50 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-700">{w.label}</p>
                <button onClick={() => copy(w.url, w.label)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition">
                  {copied === w.label ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied === w.label ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="text-xs font-mono text-blue-600 break-all">{w.url}</code>
              <p className="text-[10px] text-slate-400 mt-1">{w.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Code2 size={15} className="text-slate-600" /> API Endpoints
        </h2>
        <div className="space-y-2">
          {endpoints.map(ep => (
            <div key={ep.path} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition">
              <span className={cn('text-[10px] font-bold px-2 py-1 rounded-md font-mono flex-shrink-0',
                ep.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                {ep.method}
              </span>
              <code className="text-xs font-mono text-slate-700 flex-1">{ep.path}</code>
              <p className="text-xs text-slate-400 hidden lg:block">{ep.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook events */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Webhook size={15} className="text-slate-600" /> Outbound Webhook Events
          </h2>
          <button className="flex items-center gap-1.5 text-xs font-medium text-[#25D366] hover:underline">
            <Plus size={12} /> Add Endpoint
          </button>
        </div>
        <div className="space-y-2">
          {WEBHOOK_DOCS.map(w => (
            <div key={w.event} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <code className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded flex-shrink-0">{w.event}</code>
              <p className="text-xs text-slate-500">{w.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-slate-900 rounded-xl">
          <p className="text-xs font-mono text-slate-400 mb-2">Example payload</p>
          <pre className="text-[11px] font-mono text-green-400 overflow-x-auto">{`{
  "event": "message.sent",
  "store_id": "${storeId ?? 'your-store-id'}",
  "data": {
    "phone": "+91XXXXXXXXXX",
    "type": "abandoned_cart",
    "status": "sent"
  },
  "timestamp": "${new Date().toISOString()}"
}`}</pre>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Loader2, RefreshCw, Search } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  abandoned_cart:    'Abandoned Cart',
  cod_verification:  'COD Verify',
  order_confirmation:'Order Confirm',
  shipping_update:   'Shipping',
  broadcast:         'Broadcast',
}

const STATUS_STYLE: Record<string, string> = {
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read:      'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-700',
}

const FILTERS = ['all', 'sent', 'delivered', 'failed'] as const
type Filter = typeof FILTERS[number]

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('all')
  const [search, setSearch]     = useState('')
  const [storeId, setStoreId]   = useState<string | null>(null)
  const supabase = createClient()

  const loadMessages = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()

    if (!store) { setLoading(false); return }
    setStoreId(store.id)

    let q = supabase.from('messages').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(100)
    if (filter !== 'all') q = q.eq('status', filter)

    const { data } = await q
    setMessages(data ?? [])
    setLoading(false)
  }, [supabase, filter])

  useEffect(() => { loadMessages() }, [loadMessages])

  const filtered = messages.filter(m => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      m.customer_phone.includes(s) ||
      (m.customer_name?.toLowerCase().includes(s)) ||
      m.message.toLowerCase().includes(s)
    )
  })

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-slate-500 text-sm mt-1">All WhatsApp messages sent to your customers</p>
        </div>
        <button onClick={loadMessages} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-white transition border border-slate-200 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition',
                filter === f ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by phone or name…"
            className="text-sm text-slate-700 outline-none w-full placeholder:text-slate-400"
          />
        </div>

        <span className="text-slate-400 text-sm ml-auto">{filtered.length} messages</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700">No messages yet</p>
            <p className="text-slate-400 text-sm mt-1">Messages will appear here once automations start running</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr,2fr,100px,100px,100px] text-xs font-semibold text-slate-400 uppercase tracking-wide px-6 py-3 border-b border-slate-100 bg-slate-50">
              <span>Customer</span>
              <span>Message preview</span>
              <span>Type</span>
              <span>Status</span>
              <span>Sent</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map(msg => (
                <div key={msg.id} className="grid grid-cols-[1fr,2fr,100px,100px,100px] items-center px-6 py-3.5 hover:bg-slate-50 transition">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{msg.customer_name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{msg.customer_phone}</p>
                  </div>
                  <p className="text-sm text-slate-500 truncate pr-4">{msg.message.slice(0, 70)}…</p>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
                    {TYPE_LABELS[msg.type] ?? msg.type}
                  </span>
                  <span className={cn('text-xs px-2 py-1 rounded-lg font-medium capitalize w-fit', STATUS_STYLE[msg.status] ?? 'bg-slate-100 text-slate-500')}>
                    {msg.status}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(msg.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

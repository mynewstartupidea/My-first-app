'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Search, RefreshCw, Phone, Clock, Loader2, CheckCheck, Zap } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'
import Link from 'next/link'

interface Conversation {
  customerPhone: string
  customerName: string | null
  lastMessage: string
  lastTime: string
  messageCount: number
  lastStatus: string
  lastType: string
}

const STATUS_STYLES: Record<string, string> = {
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read:      'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-700',
}

const TYPE_LABELS: Record<string, string> = {
  abandoned_cart:    'Cart Recovery',
  cod_verification:  'COD Verify',
  order_confirmation:'Order',
  shipping_update:   'Shipping',
  post_purchase_upsell: 'Upsell',
  win_back:          'Win-back',
  review_request:    'Review',
  broadcast:         'Campaign',
}

function groupByCustomer(messages: Message[]): Conversation[] {
  const map = new Map<string, Conversation>()
  for (const msg of messages) {
    const existing = map.get(msg.customer_phone)
    if (!existing || msg.created_at > existing.lastTime) {
      map.set(msg.customer_phone, {
        customerPhone: msg.customer_phone,
        customerName:  msg.customer_name,
        lastMessage:   msg.message,
        lastTime:      msg.created_at,
        messageCount:  (existing?.messageCount ?? 0) + 1,
        lastStatus:    msg.status,
        lastType:      msg.type,
      })
    } else {
      existing.messageCount += 1
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime))
}

function initials(name: string | null, phone: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return phone.slice(-2)
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [hasStore, setHasStore]           = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()

    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(500)

    setConversations(groupByCustomer(messages ?? []))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = conversations.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.customerPhone.includes(s) || (c.customerName?.toLowerCase().includes(s))
  })

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="text-slate-500 text-sm mt-1">
            {conversations.length > 0 ? `${conversations.length} customer threads` : 'All WhatsApp conversations with your customers'}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations by name or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
        </div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <MessageSquare className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store to see conversations</p>
          <p className="text-amber-700 text-sm mt-1">Conversations appear here as automations send messages to customers.</p>
          <Link href="/dashboard/integrations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900">
            Connect store →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-slate-700">No conversations yet</p>
          <p className="text-slate-400 text-sm mt-1">Conversations appear here once automations start sending messages.</p>
          <Link href="/dashboard/automations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline">
            Enable automations →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filtered.map(conv => (
              <div key={conv.customerPhone} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition cursor-pointer">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 font-bold text-[#25D366] text-sm">
                  {initials(conv.customerName, conv.customerPhone)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{conv.customerName ?? conv.customerPhone}</p>
                    {conv.customerName && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 hidden sm:flex">
                        <Phone className="w-2.5 h-2.5" /> {conv.customerPhone}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{conv.lastMessage.slice(0, 80)}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      {TYPE_LABELS[conv.lastType] ?? conv.lastType}
                    </span>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[conv.lastStatus] ?? 'bg-slate-100 text-slate-500')}>
                      {conv.lastStatus}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {timeAgo(conv.lastTime)}
                    {conv.messageCount > 1 && (
                      <span className="ml-1 bg-slate-100 text-slate-500 rounded-full px-1.5">{conv.messageCount} msgs</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-way inbox coming soon */}
      {conversations.length > 0 && (
        <div className="mt-8 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <p className="font-semibold text-green-800">Two-way inbox coming soon</p>
            <p className="text-green-700 text-sm mt-1">
              You&apos;ll be able to read and reply to customer WhatsApp messages directly from here. Currently showing all outbound automated messages.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <CheckCheck className="w-4 h-4" /> {conversations.length} customer threads tracked
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare, Search, RefreshCw, Phone, Clock,
  Loader2, Zap, X,
} from 'lucide-react'
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
  abandoned_cart:        'Cart Recovery',
  cod_verification:      'COD Verify',
  order_confirmation:    'Order',
  shipping_update:       'Shipping',
  post_purchase_upsell:  'Upsell',
  win_back:              'Win-back',
  review_request:        'Review',
  broadcast:             'Campaign',
  lead_ad:               'Lead Form',
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-600',
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-orange-100 text-orange-600',
  'bg-pink-100 text-pink-600',
  'bg-cyan-100 text-cyan-600',
]

function avatarColor(phone: string) {
  return AVATAR_COLORS[phone.charCodeAt(phone.length - 1) % AVATAR_COLORS.length]
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
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true)
      .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()

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

  const stats = useMemo(() => {
    const delivered  = conversations.filter(c => c.lastStatus === 'delivered' || c.lastStatus === 'read').length
    const failed     = conversations.filter(c => c.lastStatus === 'failed').length
    const totalMsgs  = conversations.reduce((sum, c) => sum + c.messageCount, 0)
    return { threads: conversations.length, delivered, failed, totalMsgs }
  }, [conversations])

  const filtered = conversations.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.customerPhone.includes(s) || (c.customerName?.toLowerCase().includes(s))
  })

  return (
    <div className="p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {conversations.length > 0
              ? `${conversations.length} customer threads · ${stats.totalMsgs.toLocaleString()} messages`
              : 'All WhatsApp conversations with your customers'}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards — only show when there are conversations */}
      {conversations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Threads',          value: stats.threads,   color: '#6b7280' },
            { label: 'Delivered / Read', value: stats.delivered, color: '#10b981' },
            { label: 'Failed',           value: stats.failed,    color: '#ef4444' },
            { label: 'Total messages',   value: stats.totalMsgs, color: '#3b82f6' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.value.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        </div>
      ) : !hasStore ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-amber-400" />
          </div>
          <p className="font-semibold text-gray-800">Connect your store to see conversations</p>
          <p className="text-sm text-gray-400 mt-1">Conversations appear here as automations send messages to customers.</p>
          <Link href="/dashboard/integrations"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
            Connect store →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Search toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/40">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {search && (
              <p className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-gray-200" />
              </div>
              {search ? (
                <>
                  <p className="text-sm text-gray-400">No results for &quot;{search}&quot;</p>
                  <button onClick={() => setSearch('')} className="mt-2 text-xs text-blue-500 hover:underline">Clear search</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">No conversations yet</p>
                  <p className="text-xs text-gray-300 mt-1">Conversations appear here once automations start sending messages.</p>
                  <Link href="/dashboard/automations"
                    className="mt-4 text-sm font-medium text-blue-600 hover:underline">
                    Enable automations →
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(conv => (
                <div key={conv.customerPhone} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/40 transition-colors cursor-pointer">
                  {/* Avatar */}
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm', avatarColor(conv.customerPhone))}>
                    {initials(conv.customerName, conv.customerPhone)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{conv.customerName ?? conv.customerPhone}</p>
                      {conv.customerName && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400">
                          <Phone className="w-2.5 h-2.5" /> {conv.customerPhone}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage.slice(0, 80)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {TYPE_LABELS[conv.lastType] ?? conv.lastType}
                      </span>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[conv.lastStatus] ?? 'bg-gray-100 text-gray-500')}>
                        {conv.lastStatus}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {timeAgo(conv.lastTime)}
                      {conv.messageCount > 1 && (
                        <span className="ml-1 bg-gray-100 text-gray-500 rounded-full px-1.5">{conv.messageCount} msgs</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Two-way inbox coming soon */}
      {conversations.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 text-sm">Two-way inbox coming soon</p>
            <p className="text-blue-700 text-xs mt-0.5">
              You&apos;ll be able to read and reply to customer WhatsApp messages directly from here.
              Currently showing all outbound automated messages.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

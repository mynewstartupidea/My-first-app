'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Send, RefreshCw, Phone, Clock, CheckCheck,
  Check, Loader2, MessageCircle, User, ShoppingBag,
  Tag, X, ChevronDown, MoreVertical, Inbox, Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo, formatCurrency } from '@/lib/utils'

interface Message {
  id: string
  customer_phone: string
  customer_name: string | null
  message: string
  type: string
  status: string
  created_at: string
  revenue_attributed: number
}

interface Customer {
  id: string
  phone: string
  name: string | null
  email: string | null
  total_orders: number
  total_spent: number
  last_order_at: string | null
  whatsapp_opt_in: boolean
}

interface Thread {
  phone: string
  name: string | null
  lastMsg: string
  lastTime: string
  count: number
  status: string
  unread: boolean
  type: string
}

const TYPE_LABELS: Record<string, string> = {
  abandoned_cart: 'Cart Recovery', cod_verification: 'COD',
  order_confirmation: 'Order', shipping_update: 'Shipping',
  post_purchase_upsell: 'Upsell', win_back: 'Win-back',
  review_request: 'Review', broadcast: 'Campaign',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent:      <Check size={12} className="text-slate-400" />,
  delivered: <CheckCheck size={12} className="text-slate-400" />,
  read:      <CheckCheck size={12} className="text-[#25D366]" />,
  failed:    <X size={12} className="text-red-400" />,
}

function initials(name: string | null, phone: string) {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return phone.slice(-2)
}

function avatarColor(phone: string) {
  const colors = ['bg-violet-100 text-violet-600', 'bg-blue-100 text-blue-600',
    'bg-emerald-100 text-emerald-600', 'bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600', 'bg-cyan-100 text-cyan-600']
  return colors[phone.charCodeAt(phone.length - 1) % colors.length]
}

export default function LiveChatPage() {
  const [threads, setThreads]           = useState<Thread[]>([])
  const [messages, setMessages]         = useState<Message[]>([])
  const [customer, setCustomer]         = useState<Customer | null>(null)
  const [selected, setSelected]         = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply, setReply]               = useState('')
  const [sending, setSending]           = useState(false)
  const [storeId, setStoreId]           = useState<string | null>(null)
  const [filter, setFilter]             = useState<'all' | 'open' | 'resolved'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true)
      .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (!store) { setLoading(false); return }
    setStoreId(store.id)

    const { data: msgs } = await supabase
      .from('messages')
      .select('id,customer_phone,customer_name,message,type,status,created_at,revenue_attributed')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1000)

    const map = new Map<string, Thread>()
    for (const m of msgs ?? []) {
      const ex = map.get(m.customer_phone)
      if (!ex) {
        map.set(m.customer_phone, {
          phone: m.customer_phone, name: m.customer_name,
          lastMsg: m.message, lastTime: m.created_at,
          count: 1, status: m.status, unread: m.status === 'sent', type: m.type,
        })
      } else {
        ex.count++
        if (m.created_at > ex.lastTime) {
          ex.lastMsg = m.message; ex.lastTime = m.created_at
          ex.status = m.status; ex.type = m.type
        }
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime))
    setThreads(sorted)
    setLoading(false)
  }, [supabase])

  const loadThread = useCallback(async (phone: string) => {
    if (!storeId) return
    setLoadingThread(true)
    const [msgsRes, custRes] = await Promise.all([
      supabase.from('messages').select('*').eq('store_id', storeId)
        .eq('customer_phone', phone).order('created_at', { ascending: true }),
      supabase.from('customers').select('*').eq('store_id', storeId)
        .eq('phone', phone).maybeSingle(),
    ])
    setMessages(msgsRes.data ?? [])
    setCustomer(custRes.data ?? null)
    setLoadingThread(false)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [storeId, supabase])

  useEffect(() => { loadThreads() }, [loadThreads])

  useEffect(() => {
    if (selected) loadThread(selected)
  }, [selected, loadThread])

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selected, message: reply.trim() }),
    })
    if (res.ok) {
      setReply('')
      await loadThread(selected)
      await loadThreads()
    }
    setSending(false)
  }

  const filtered = threads.filter(t => {
    if (search) {
      const s = search.toLowerCase()
      if (!t.phone.includes(s) && !t.name?.toLowerCase().includes(s)) return false
    }
    return true
  })

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-slate-50">

      {/* Thread list */}
      <div className="w-[300px] flex-shrink-0 flex flex-col bg-white border-r border-slate-100">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Inbox size={16} className="text-[#25D366]" /> Live Chat
            </h1>
            <button onClick={loadThreads} className="text-slate-400 hover:text-slate-600 transition">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 bg-slate-50"
            />
          </div>
          <div className="flex gap-1 mt-2.5">
            {(['all', 'open', 'resolved'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('flex-1 text-[11px] py-1 rounded-lg font-medium capitalize transition',
                  filter === f ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:bg-slate-100')}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={18} className="animate-spin text-[#25D366]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">No conversations yet</p>
            </div>
          ) : (
            filtered.map(t => (
              <button key={t.phone} onClick={() => setSelected(t.phone)}
                className={cn('w-full flex items-start gap-3 px-4 py-3.5 border-b border-slate-50 text-left transition hover:bg-slate-50',
                  selected === t.phone ? 'bg-[#25D366]/5 border-l-2 border-l-[#25D366]' : '')}>
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold', avatarColor(t.phone))}>
                  {initials(t.name, t.phone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">
                      {t.name ?? t.phone}
                    </p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{timeAgo(t.lastTime)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.lastMsg.slice(0, 55)}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                    {t.unread && <Circle size={6} className="text-[#25D366] fill-[#25D366]" />}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold', avatarColor(selected))}>
                {initials(threads.find(t => t.phone === selected)?.name ?? null, selected)}
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  {threads.find(t => t.phone === selected)?.name ?? selected}
                </p>
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Phone size={10} /> {selected}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                <Tag size={11} /> Tag
              </button>
              <button className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                <Check size={11} /> Resolve
              </button>
              <button className="text-slate-400 hover:text-slate-600 transition">
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loadingThread ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={18} className="animate-spin text-[#25D366]" />
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[70%]">
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                    <p className="text-slate-800 text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                    <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                    {STATUS_ICON[msg.status]}
                    <span className="text-[9px] text-slate-300 bg-slate-100 px-1.5 rounded-full">
                      {TYPE_LABELS[msg.type] ?? msg.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="bg-white border-t border-slate-100 p-4 flex-shrink-0">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#25D366]/30 focus-within:border-[#25D366]/50">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none"
                />
              </div>
              <button onClick={sendReply} disabled={!reply.trim() || sending}
                className="w-10 h-10 flex items-center justify-center bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-40 text-white rounded-full transition flex-shrink-0 shadow-sm">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 px-1">
              Messages are sent via your connected WhatsApp account
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-[#25D366]" />
            </div>
            <p className="font-semibold text-slate-700">Select a conversation</p>
            <p className="text-slate-400 text-sm mt-1">Choose a thread from the left to view messages</p>
          </div>
        </div>
      )}

      {/* Customer info panel */}
      {selected && customer && (
        <div className="w-[240px] flex-shrink-0 bg-white border-l border-slate-100 overflow-y-auto">
          <div className="p-4 border-b border-slate-100">
            <p className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
              <User size={13} /> Customer
            </p>
            <div className="space-y-1.5 text-xs">
              <div>
                <p className="text-slate-400">Name</p>
                <p className="font-medium text-slate-700">{customer.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">Phone</p>
                <p className="font-medium text-slate-700">{customer.phone}</p>
              </div>
              {customer.email && (
                <div>
                  <p className="text-slate-400">Email</p>
                  <p className="font-medium text-slate-700 truncate">{customer.email}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-slate-100">
            <p className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
              <ShoppingBag size={13} /> Shopify
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Orders</span>
                <span className="font-semibold text-slate-700">{customer.total_orders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Spent</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(customer.total_spent)}</span>
              </div>
              {customer.last_order_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Order</span>
                  <span className="font-medium text-slate-700">{timeAgo(customer.last_order_at)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WhatsApp</span>
                <span className={cn('font-medium', customer.whatsapp_opt_in ? 'text-emerald-600' : 'text-red-500')}>
                  {customer.whatsapp_opt_in ? 'Opted in' : 'Opted out'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <p className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
              <Tag size={13} /> Quick Actions
            </p>
            <div className="space-y-2">
              {['Send Template', 'Add Note', 'Assign To', 'Add Tag'].map(action => (
                <button key={action}
                  className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg transition flex items-center justify-between">
                  {action} <ChevronDown size={11} className="rotate-[-90deg] text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

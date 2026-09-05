'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Send, RefreshCw, Phone, X, CheckCheck,
  Check, Loader2, MessageCircle, User, ShoppingBag,
  Tag, ChevronDown, MoreVertical, Inbox, Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo, formatCurrency } from '@/lib/utils'

type LeadStatus = 'hot' | 'warm' | 'lost' | 'converted' | 'junk' | 'resolved'

const STATUS_META: Record<LeadStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  hot:       { label: 'Hot',       dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  warm:      { label: 'Warm',      dot: '#f97316', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  converted: { label: 'Converted', dot: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  lost:      { label: 'Lost',      dot: '#6b7280', bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
  junk:      { label: 'Junk',      dot: '#9ca3af', bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  resolved:  { label: 'Resolved',  dot: '#3b82f6', bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
}

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
  tag: LeadStatus | null
}

const TYPE_LABELS: Record<string, string> = {
  abandoned_cart: 'Cart Recovery', cod_verification: 'COD',
  order_confirmation: 'Order', shipping_update: 'Shipping',
  post_purchase_upsell: 'Upsell', win_back: 'Win-back',
  review_request: 'Review', broadcast: 'Campaign',
  lead_ad: 'Lead Form',
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

function TagDropdown({ currentTag, onSelect, onClose }: {
  currentTag: LeadStatus | null
  onSelect: (tag: LeadStatus | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-40">
      {(Object.entries(STATUS_META) as [LeadStatus, typeof STATUS_META[LeadStatus]][]).map(([key, meta]) => (
        <button key={key} onClick={() => onSelect(key)}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
          <span className="text-xs font-medium text-slate-700">{meta.label}</span>
          {currentTag === key && <Check size={11} className="text-slate-400 ml-auto" />}
        </button>
      ))}
      {currentTag && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => onSelect(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left">
            <X size={11} className="text-slate-400" />
            <span className="text-xs text-slate-400">Clear tag</span>
          </button>
        </>
      )}
    </div>
  )
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
  const [tagFilter, setTagFilter]       = useState<LeadStatus | null>(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
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
          count: 1, status: m.status, unread: m.status === 'sent',
          type: m.type, tag: null,
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

    // Batch-fetch lead tags for all phones
    if (sorted.length > 0) {
      const phones = sorted.map(t => t.phone).join(',')
      try {
        const tagRes = await fetch(`/api/live-chat/tags?phones=${encodeURIComponent(phones)}`)
        const tagData = await tagRes.json() as { tags: Record<string, string> }
        for (const t of sorted) {
          t.tag = (tagData.tags[t.phone] as LeadStatus) ?? null
        }
      } catch { /* non-fatal */ }
    }

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
  useEffect(() => { if (selected) loadThread(selected) }, [selected, loadThread])

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selected, message: reply.trim() }),
    })
    if (res.ok) { setReply(''); await loadThread(selected); await loadThreads() }
    setSending(false)
  }

  const handleTag = async (phone: string, status: LeadStatus | null) => {
    // Optimistically update local state
    setThreads(prev => prev.map(t => t.phone === phone ? { ...t, tag: status } : t))
    setTagDropdownOpen(false)
    await fetch('/api/live-chat/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status }),
    })
  }

  const selectedThread = threads.find(t => t.phone === selected)

  const filtered = threads.filter(t => {
    if (search) {
      const s = search.toLowerCase()
      if (!t.phone.includes(s) && !t.name?.toLowerCase().includes(s)) return false
    }
    if (tagFilter && t.tag !== tagFilter) return false
    return true
  })

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-slate-50">

      {/* Thread list */}
      <div className="w-[300px] flex-shrink-0 flex flex-col bg-white border-r border-slate-100">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Inbox size={16} className="text-[#25D366]" /> Live Chat
            </h1>
            <button onClick={loadThreads} className="text-slate-400 hover:text-slate-600 transition">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 bg-slate-50"
            />
          </div>

          {/* Lead status filter chips */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTagFilter(null)}
              className={cn('text-[10px] px-2.5 py-1 rounded-full font-medium border transition',
                tagFilter === null ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-500 border-slate-200 hover:border-slate-300'
              )}>
              All
            </button>
            {(Object.entries(STATUS_META) as [LeadStatus, typeof STATUS_META[LeadStatus]][]).map(([key, meta]) => (
              <button key={key}
                onClick={() => setTagFilter(tagFilter === key ? null : key)}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium border transition"
                style={tagFilter === key
                  ? { background: meta.dot, color: '#fff', borderColor: meta.dot }
                  : { background: meta.bg, color: meta.text, borderColor: meta.border }
                }>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tagFilter === key ? '#fff' : meta.dot }} />
                {meta.label}
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
              <p className="text-slate-400 text-xs">No conversations{tagFilter ? ` tagged "${STATUS_META[tagFilter].label}"` : ''}</p>
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
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                    {t.unread && <Circle size={6} className="text-[#25D366] fill-[#25D366]" />}
                    {t.tag && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: STATUS_META[t.tag].bg, color: STATUS_META[t.tag].text }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: STATUS_META[t.tag].dot }} />
                        {STATUS_META[t.tag].label}
                      </span>
                    )}
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
                {initials(selectedThread?.name ?? null, selected)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm">
                    {selectedThread?.name ?? selected}
                  </p>
                  {selectedThread?.tag && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: STATUS_META[selectedThread.tag].bg, color: STATUS_META[selectedThread.tag].text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[selectedThread.tag].dot }} />
                      {STATUS_META[selectedThread.tag].label}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Phone size={10} /> {selected}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Tag button with dropdown */}
              <div className="relative">
                <button
                  onClick={() => setTagDropdownOpen(o => !o)}
                  className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                  <Tag size={11} />
                  {selectedThread?.tag ? STATUS_META[selectedThread.tag].label : 'Tag'}
                  <ChevronDown size={10} />
                </button>
                {tagDropdownOpen && selected && (
                  <TagDropdown
                    currentTag={selectedThread?.tag ?? null}
                    onSelect={(status) => handleTag(selected, status)}
                    onClose={() => setTagDropdownOpen(false)}
                  />
                )}
              </div>
              <button
                onClick={() => selected && handleTag(selected, selectedThread?.tag === 'resolved' ? null : 'resolved')}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1',
                  selectedThread?.tag === 'resolved'
                    ? 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                    : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                )}>
                <Check size={11} /> {selectedThread?.tag === 'resolved' ? 'Resolved' : 'Resolve'}
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
              <div><p className="text-slate-400">Name</p><p className="font-medium text-slate-700">{customer.name ?? '—'}</p></div>
              <div><p className="text-slate-400">Phone</p><p className="font-medium text-slate-700">{customer.phone}</p></div>
              {customer.email && <div><p className="text-slate-400">Email</p><p className="font-medium text-slate-700 truncate">{customer.email}</p></div>}
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
        </div>
      )}
    </div>
  )
}

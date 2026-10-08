'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Send, RefreshCw, Phone, X, CheckCheck,
  Check, Loader2, MessageCircle, User, ShoppingBag,
  Tag, ChevronDown, MoreVertical, Inbox, Circle, AlertTriangle, ChevronLeft,
  Sparkles, Trash2, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo, formatCurrency } from '@/lib/utils'

type LeadStatus = 'hot' | 'warm' | 'cold' | 'lost' | 'converted' | 'junk' | 'resolved'

const STATUS_META: Record<LeadStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  hot:       { label: 'Hot',       dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  warm:      { label: 'Warm',      dot: '#f97316', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  cold:      { label: 'Cold',      dot: '#6366f1', bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  converted: { label: 'Converted', dot: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  lost:      { label: 'Lost',      dot: '#6b7280', bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
  junk:      { label: 'Junk',      dot: '#9ca3af', bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  resolved:  { label: 'Resolved',  dot: '#3b82f6', bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
}

// Unified shape for rendering a thread — merges outbound `messages` rows with
// inbound `inbound_messages` rows (previously never read anywhere, so replies
// never appeared in this inbox at all).
interface ChatMsg {
  id: string
  text: string
  type: string
  status: string
  direction: 'in' | 'out'
  created_at: string
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
  lead_ad: 'Lead Form', whatsapp_business_app: 'Sent from phone',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  sending:   <Clock size={11} className="text-slate-300" />,
  sent:      <Check size={12} className="text-slate-400" />,
  delivered: <CheckCheck size={12} className="text-slate-400" />,
  read:      <CheckCheck size={12} className="text-[#25D366]" />,
  failed:    <X size={12} className="text-red-400" />,
}

const BLOCK_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

function isProbablyBlocked(t: Thread): boolean {
  return t.status === 'sent' && (Date.now() - new Date(t.lastTime).getTime()) > BLOCK_THRESHOLD_MS
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

function MoreMenu({ onDelete, onClose }: { onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-48">
      <button onClick={onDelete}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 transition text-left">
        <Trash2 size={13} className="text-red-500" />
        <span className="text-xs font-medium text-red-600">Delete conversation</span>
      </button>
    </div>
  )
}

function DeleteChatModal({ name, onCancel, onConfirm, deleting }: {
  name: string; onCancel: () => void; onConfirm: () => void; deleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
        <h3 className="font-semibold text-slate-900 text-base">Delete this conversation?</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          This permanently deletes the entire message history with <span className="font-medium text-slate-700">{name}</span>. This can&apos;t be undone.
        </p>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition disabled:opacity-60">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LiveChatPage() {
  const router = useRouter()
  const [threads, setThreads]           = useState<Thread[]>([])
  const [messages, setMessages]         = useState<ChatMsg[]>([])
  const [customer, setCustomer]         = useState<Customer | null>(null)
  const [selected, setSelected]         = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply, setReply]               = useState('')
  const [storeId, setStoreId]           = useState<string | null>(null)
  const [tagFilter, setTagFilter]       = useState<LeadStatus | null>(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [aiEnabled, setAiEnabled]       = useState(false)
  const [aiToggling, setAiToggling]     = useState(false)
  const [isAdmin, setIsAdmin]           = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMsgCountRef = useRef(0)
  const sendInFlightRef = useRef(false)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }, [])

  // AI on/off is owner/admin only (same tier as billing) — a rep or manager
  // never sees the button, and the API would 403 them anyway if they tried.
  useEffect(() => {
    fetch('/api/me/role')
      .then(r => r.json())
      .then((d: { role?: string }) => {
        const admin = d.role === 'owner' || d.role === 'admin'
        setIsAdmin(admin)
        if (!admin) return
        return fetch('/api/ai/knowledge-base')
          .then(r => r.json())
          .then((kb: { enabled?: boolean }) => setAiEnabled(!!kb.enabled))
      })
      .catch(() => {})
  }, [])

  async function toggleAI() {
    if (aiToggling) return
    setAiToggling(true)
    const next = !aiEnabled
    try {
      const res = await fetch('/api/ai/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await res.json().catch(() => ({})) as { enabled?: boolean; error?: string }
      if (res.ok) {
        setAiEnabled(data.enabled ?? next)
      } else if (data.error === 'needs_knowledge_base') {
        router.push('/dashboard/ai-assistant?needsInfo=1')
      } else {
        showToast(`Couldn't turn AI auto-reply ${next ? 'on' : 'off'} — please try again.`, false)
      }
    } catch {
      showToast(`Couldn't turn AI auto-reply ${next ? 'on' : 'off'} — check your connection and try again.`, false)
    } finally {
      setAiToggling(false)
    }
  }

  // Both of these go through server routes (resolved to the org owner)
  // rather than querying stores/messages/inbound_messages/customers directly
  // — those tables' RLS is USING (auth.uid() = user_id) with no team-member
  // carve-out, so a teammate always saw "No conversations" here regardless
  // of the org's real chat history.
  // `opts.silent` backs the background polling below — no loading spinner,
  // no error toast, so a routine refresh in the background never flickers
  // the UI or interrupts someone mid-reply.
  const loadThreads = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true)
    try {
      const res = await fetch('/api/live-chat/threads')
      if (!res.ok) {
        if (!opts.silent) showToast("Couldn't load your conversations — refresh the page to try again.", false)
        return
      }
      const data = await res.json() as { storeId: string | null; threads: Thread[] }
      if (!data.storeId) return
      setStoreId(data.storeId)
      setThreads(data.threads)
    } catch {
      if (!opts.silent) showToast("Couldn't load your conversations — check your connection and try again.", false)
    } finally {
      if (!opts.silent) setLoading(false)
    }
  }, [showToast])

  const loadThread = useCallback(async (phone: string, opts: { silent?: boolean } = {}) => {
    if (!storeId) return
    if (!opts.silent) setLoadingThread(true)
    try {
      const res = await fetch(`/api/live-chat/thread?phone=${encodeURIComponent(phone)}`)
      const data = res.ok ? await res.json() as { messages: ChatMsg[]; customer: Customer | null } : { messages: [], customer: null }
      if (!res.ok) {
        if (!opts.silent) showToast("Couldn't load this conversation — please try again.", false)
        return
      }
      const grew = data.messages.length > prevMsgCountRef.current
      prevMsgCountRef.current = data.messages.length
      setMessages(data.messages)
      setCustomer(data.customer)
      // Only yank the scroll position on a background refresh if a new
      // message actually arrived — otherwise someone reading older history
      // during a silent poll would get bumped back to the bottom.
      if (!opts.silent || grew) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {
      if (!opts.silent) showToast("Couldn't load this conversation — check your connection and try again.", false)
    } finally {
      if (!opts.silent) setLoadingThread(false)
    }
  }, [storeId, showToast])

  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => { if (selected) loadThread(selected) }, [selected, loadThread])

  // Live Chat has no realtime subscription — Supabase RLS on messages/
  // inbound_messages has no team-member carve-out (see threads/route.ts),
  // so a direct client-side postgres_changes subscription would silently
  // see nothing for anyone but the store owner. Short background polling is
  // what actually keeps this feeling like a live chat instead of a page
  // that needs a manual refresh every time a reply comes in. Paused while
  // the tab isn't visible so it doesn't run forever in a background tab.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadThreads({ silent: true })
    }, 4000)
    return () => clearInterval(id)
  }, [loadThreads])

  useEffect(() => {
    if (!selected) return
    const id = setInterval(() => {
      // Skip while a send is in flight for this thread — the real WhatsApp
      // round-trip can take a second or more, and this poll firing mid-send
      // would overwrite the screen with server data that doesn't have the
      // new message yet, wiping the optimistic bubble until the next tick
      // picked it back up (the "message disappears for 2s" bug).
      if (document.visibilityState === 'visible' && !sendInFlightRef.current) loadThread(selected, { silent: true })
    }, 2500)
    return () => clearInterval(id)
  }, [selected, loadThread])

  async function sendReply() {
    if (!reply.trim() || !selected) return
    const text = reply.trim()
    const phone = selected

    // Optimistic send — the message appears in the thread and the input
    // clears immediately, the way an actual chat app behaves, instead of
    // locking the UI behind a spinner for however long the real WhatsApp
    // round-trip takes. A 'sending' bubble (small clock icon, same spot the
    // sent/delivered/read ticks go) shows it hasn't been confirmed yet;
    // the background poll (or the sync right after this call resolves)
    // replaces it with the real row, or flips it to a failed/red X on error.
    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, text, type: 'manual_reply', status: 'sending',
      direction: 'out', created_at: new Date().toISOString(),
    }])
    setReply('')
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    sendInFlightRef.current = true
    try {
      // /api/live-chat/send — a dedicated route (was /api/whatsapp/test, which
      // always sends a fixed hello_world template and silently ignored the
      // typed message; fine for Settings' "send yourself a test", wrong here).
      const res = await fetch('/api/live-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text }),
      })
      if (res.ok) {
        await loadThread(phone, { silent: true })
        loadThreads({ silent: true })
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
        showToast(data.error ?? "Couldn't send your message — please try again.", false)
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
      showToast("Couldn't send your message — check your connection and try again.", false)
    } finally {
      sendInFlightRef.current = false
    }
  }

  const handleTag = async (phone: string, status: LeadStatus | null) => {
    // Optimistically update local state — reverted below if the save fails.
    const prevTag = threads.find(t => t.phone === phone)?.tag ?? null
    setThreads(prev => prev.map(t => t.phone === phone ? { ...t, tag: status } : t))
    setTagDropdownOpen(false)
    try {
      const res = await fetch('/api/live-chat/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, status }),
      })
      if (!res.ok) {
        setThreads(prev => prev.map(t => t.phone === phone ? { ...t, tag: prevTag } : t))
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't save this tag — please try again.", false)
      }
    } catch {
      setThreads(prev => prev.map(t => t.phone === phone ? { ...t, tag: prevTag } : t))
      showToast("Couldn't save this tag — check your connection and try again.", false)
    }
  }

  async function handleDeleteThread() {
    if (!selected || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/live-chat/thread?phone=${encodeURIComponent(selected)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? "Couldn't delete this conversation — please try again.", false)
        return
      }
      setThreads(prev => prev.filter(t => t.phone !== selected))
      setDeleteConfirmOpen(false)
      setSelected(null)
      setMessages([])
      setCustomer(null)
    } catch {
      showToast("Couldn't delete this conversation — check your connection and try again.", false)
    } finally {
      setDeleting(false)
    }
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
    <>
    {toast && (
      <div className={cn(
        'fixed top-4 left-4 right-4 sm:left-auto sm:top-5 sm:right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium sm:max-w-sm',
        toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
      )}>
        {toast.ok ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <AlertCircle size={16} className="flex-shrink-0" />}
        {toast.msg}
      </div>
    )}
    {deleteConfirmOpen && selectedThread && (
      <DeleteChatModal
        name={selectedThread.name ?? selectedThread.phone}
        deleting={deleting}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteThread}
      />
    )}
    <div className="flex h-[calc(100vh-52px-76px)] md:h-[calc(100vh-0px)] overflow-hidden bg-slate-50">

      {/* Thread list — full width on mobile when no thread selected, hidden when thread open */}
      <div className={cn(
        "flex-shrink-0 flex flex-col bg-white border-r border-slate-100",
        selected ? "hidden md:flex md:w-[300px]" : "w-full md:w-[300px]"
      )}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Inbox size={16} className="text-[#25D366]" /> Live Chat
            </h1>
            <div className="flex items-center gap-2">
              {/* AI auto-reply toggle — global to the WhatsApp number, not
                  per-conversation. Owner/admin only. Off without a knowledge
                  base: toggleAI() sends the merchant to /dashboard/ai-assistant. */}
              {isAdmin && (
                <button
                  onClick={toggleAI}
                  disabled={aiToggling}
                  title={aiEnabled ? 'AI auto-reply is on — click to turn off' : 'Turn on AI auto-reply'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition disabled:opacity-60 ${
                    aiEnabled ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles size={12} className="flex-shrink-0" />
                  AI {aiEnabled ? 'On' : 'Off'}
                </button>
              )}
              <button onClick={() => loadThreads()} className="text-slate-400 hover:text-slate-600 transition">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-2 text-base border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 bg-slate-50"
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
                    {t.unread && !isProbablyBlocked(t) && <Circle size={6} className="text-[#25D366] fill-[#25D366]" />}
                    {isProbablyBlocked(t) && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        <AlertTriangle size={9} /> Not delivered
                      </span>
                    )}
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
          <div className="bg-white border-b border-slate-100 px-3 md:px-5 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Back button — mobile only */}
              <button
                onClick={() => setSelected(null)}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 transition flex-shrink-0"
              >
                <ChevronLeft size={20} />
              </button>
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', avatarColor(selected))}>
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
              {isAdmin && (
                <div className="relative">
                  <button onClick={() => setMoreMenuOpen(o => !o)} className="text-slate-400 hover:text-slate-600 transition">
                    <MoreVertical size={16} />
                  </button>
                  {moreMenuOpen && (
                    <MoreMenu
                      onDelete={() => { setMoreMenuOpen(false); setDeleteConfirmOpen(true) }}
                      onClose={() => setMoreMenuOpen(false)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loadingThread ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={18} className="animate-spin text-[#25D366]" />
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} className={cn('flex', msg.direction === 'in' ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[70%]">
                  <div className={cn(
                    'rounded-2xl px-4 py-2.5 shadow-sm',
                    msg.direction === 'in'
                      ? 'bg-white border border-slate-100 rounded-tl-sm'
                      : 'bg-[#DCF8C6] rounded-tr-sm'
                  )}>
                    <p className="text-slate-800 text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <div className={cn('flex items-center gap-1.5 mt-1 px-1', msg.direction === 'in' ? 'justify-start' : 'justify-end')}>
                    <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                    {msg.direction === 'out' && STATUS_ICON[msg.status]}
                    <span className="text-[9px] text-slate-300 bg-slate-100 px-1.5 rounded-full">
                      {msg.direction === 'in' ? 'Reply' : (TYPE_LABELS[msg.type] ?? msg.type)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Block warning banner */}
          {selectedThread && isProbablyBlocked(selectedThread) && (
            <div className="flex items-start gap-3 px-5 py-3 bg-amber-50 border-t border-amber-100 flex-shrink-0">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">Message not delivered after 24h</p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                  This contact may have blocked you. Sending another message won't reach them. Consider marking this lead as Lost.
                </p>
              </div>
            </div>
          )}

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
                  className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none"
                />
              </div>
              <button onClick={sendReply} disabled={!reply.trim()}
                className="w-10 h-10 flex items-center justify-center bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-40 text-white rounded-full transition flex-shrink-0 shadow-sm">
                <Send size={15} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 px-1">
              Messages are sent via your connected WhatsApp account
            </p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-[#25D366]" />
            </div>
            <p className="font-semibold text-slate-700">Select a conversation</p>
            <p className="text-slate-400 text-sm mt-1">Choose a thread from the left to view messages</p>
          </div>
        </div>
      )}

      {/* Customer info panel — desktop only; on mobile the message thread needs the full width */}
      {selected && customer && (
        <div className="hidden md:block md:w-[240px] flex-shrink-0 bg-white border-l border-slate-100 overflow-y-auto">
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
    </>
  )
}

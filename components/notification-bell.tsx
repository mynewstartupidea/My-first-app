'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen]               = useState(false)
  const [items, setItems]             = useState<Notification[]>([])
  const [loading, setLoading]         = useState(false)
  const panelRef                      = useRef<HTMLDivElement>(null)
  const router                        = useRouter()

  const unread = items.filter(n => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications')
      const d = await r.json() as { notifications?: Notification[] }
      setItems(d.notifications ?? [])
    } catch { /* non-fatal */ }
  }, [])

  // Poll every 30s
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function markRead(ids: string[]) {
    setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) await markRead([n.id])
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const iconCfg: Record<string, { bg: string; color: string }> = {
    template_approved: { bg: 'bg-green-100', color: 'text-green-600' },
    template_rejected: { bg: 'bg-red-100',   color: 'text-red-500'   },
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative w-8 h-8 flex items-center justify-center rounded-lg transition',
          open ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
        )}
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500 transition">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              items.map(n => {
                const cfg = iconCfg[n.type] ?? { bg: 'bg-slate-100', color: 'text-slate-500' }
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition',
                      !n.is_read && 'bg-blue-50/40'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                      <FileText size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-xs font-semibold leading-snug', n.is_read ? 'text-slate-600' : 'text-slate-900')}>
                          {n.title}
                        </p>
                        {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                      </div>
                      {n.body && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-slate-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <button
                onClick={() => { setOpen(false); router.push('/dashboard/templates') }}
                className="text-[11px] text-blue-500 hover:text-blue-700 font-medium transition"
              >
                Go to Templates →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

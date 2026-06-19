'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LifeBuoy, Send, CheckCircle2, Loader2, Clock,
  MessageSquare, ChevronDown, ChevronUp, Tag, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Ticket {
  id: string
  subject: string
  category: string
  message: string
  status: string
  priority: string
  created_at: string
  admin_notes: string | null
  resolved_at: string | null
}

const CATEGORIES = [
  { value: 'general',   label: 'General Question' },
  { value: 'billing',   label: 'Billing & Plans' },
  { value: 'whatsapp',  label: 'WhatsApp Connection' },
  { value: 'campaigns', label: 'Campaigns & Automations' },
  { value: 'shopify',   label: 'Shopify Integration' },
  { value: 'bug',       label: 'Bug Report' },
  { value: 'other',     label: 'Other' },
]

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'bg-blue-50 text-blue-600' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-600' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-50 text-emerald-600' },
  closed:      { label: 'Closed',      cls: 'bg-slate-100 text-slate-500' },
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function SupportPage() {
  const [subject,   setSubject]   = useState('')
  const [category,  setCategory]  = useState('general')
  const [message,   setMessage]   = useState('')
  const [priority,  setPriority]  = useState('normal')
  const [submitting, setSubmitting] = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState('')
  const [tickets,   setTickets]   = useState<Ticket[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    const res = await fetch('/api/support')
    const data = await res.json()
    setTickets(data.tickets ?? [])
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in subject and message.')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/support', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subject, category, message, priority }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed to submit. Try again.'); return }
    setSuccess(true)
    setSubject('')
    setMessage('')
    setPriority('normal')
    setCategory('general')
    loadTickets()
    setTimeout(() => setSuccess(false), 4000)
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LifeBuoy size={22} className="text-slate-700" /> Help & Support
        </h1>
        <p className="text-slate-500 text-sm mt-1">Submit a query or report an issue — we respond within 24 hours</p>
      </div>

      {/* Submit form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-7">
        <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
          <MessageSquare size={15} className="text-slate-600" /> New Support Request
        </h2>

        {success && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-5 text-sm">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            Ticket submitted! We&apos;ll get back to you within 24 hours.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Subject *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent placeholder:text-slate-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white">
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or screenshots if relevant."
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent placeholder:text-slate-400 resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-[#25D366] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1aad54] disabled:opacity-60 transition">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* Previous tickets */}
      {tickets.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Clock size={15} className="text-slate-500" /> My Tickets
            </h2>
            <span className="text-xs text-slate-400">{tickets.length} total</span>
          </div>
          <div className="divide-y divide-slate-50">
            {tickets.map(t => {
              const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.open
              const isOpen = expanded === t.id
              return (
                <div key={t.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/70 transition text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', st.cls)}>
                          {st.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Tag size={9} /> {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(t.created_at)}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 bg-slate-50/50 border-t border-slate-100">
                      <p className="text-sm text-slate-700 mt-4 leading-relaxed whitespace-pre-wrap">{t.message}</p>
                      {t.admin_notes && (
                        <div className="mt-4 bg-[#25D366]/8 border border-[#25D366]/20 rounded-xl p-4">
                          <p className="text-[11px] font-semibold text-[#25D366] uppercase tracking-wide mb-1.5">Response from Wapaci Team</p>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{t.admin_notes}</p>
                          {t.resolved_at && (
                            <p className="text-[10px] text-slate-400 mt-2">Resolved {timeAgo(t.resolved_at)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: '📚', title: 'WhatsApp Setup Guide', desc: 'Step-by-step Meta Embedded Signup', href: '/dashboard/settings?tab=whatsapp' },
          { icon: '💳', title: 'Billing & Plans',       desc: 'Manage subscription and usage',   href: '/dashboard/billing' },
          { icon: '🔌', title: 'Integrations',          desc: 'Connect Shopify and other tools', href: '/dashboard/integrations' },
        ].map(link => (
          <a key={link.title} href={link.href}
            className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-[#25D366]/30 hover:shadow-sm transition group">
            <div className="text-xl mb-2">{link.icon}</div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-[#25D366] transition">{link.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}

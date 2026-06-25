'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Users, Search, Upload, Loader2, Phone,
  X, FileText, AlertCircle, CheckCircle2,
  MessageCircle, RefreshCw, Send, ArrowRight,
  FolderOpen, ShieldCheck, ListChecks, Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  phone: string
  name: string | null
  email: string | null
  whatsapp_opt_in: boolean
  created_at: string
}

interface UploadResult {
  filename?: string
  uploaded_at?: string
  found: number
  valid: number
  whatsapp: number
  saved: number
  skipped: number
  whatsapp_checked: boolean
}

interface UploadHistory extends UploadResult {
  id: string
  label: string
}

interface Campaign {
  id: string
  name: string
  status: string
  sent_count: number
  failed_count?: number
  created_at: string
}

type UploadState = 'idle' | 'reading' | 'uploading' | 'done' | 'error'

// ─── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: (result: UploadResult) => void }) {
  const [state, setState]     = useState<UploadState>('idle')
  const [result, setResult]   = useState<UploadResult | null>(null)
  const [error, setError]     = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!['csv', 'txt', 'vcf'].includes(ext)) {
      setError('Please upload a CSV, TXT, or VCF file.')
      setState('error')
      return
    }
    try {
      setState('reading')
      const content = await file.text()
      setState('uploading')
      const res = await fetch('/api/contacts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: file.name }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Upload failed. Please try again.')
        setState('error')
        return
      }
      const data = await res.json() as UploadResult
      setResult(data)
      setState('done')
    } catch {
      setError('Network error. Check your connection and try again.')
      setState('error')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function reset() {
    setState('idle'); setResult(null); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <Upload size={15} className="text-[#25D366]" />
            </div>
            <h2 className="font-semibold text-slate-900">Upload Contacts</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">

          {/* IDLE */}
          {state === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition',
                  dragOver ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-[#25D366]/50 hover:bg-slate-50'
                )}>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Drop your file here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 inline-block">
                  CSV · TXT · VCF
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt,.vcf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
              <p className="text-[11px] text-slate-400 text-center mt-3">
                We&apos;ll find all Indian mobile numbers and check which ones have WhatsApp.
              </p>
            </>
          )}

          {/* READING */}
          {state === 'reading' && (
            <div className="text-center py-10">
              <Loader2 size={32} className="animate-spin text-[#25D366] mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Reading file…</p>
            </div>
          )}

          {/* UPLOADING */}
          {state === 'uploading' && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-3">
                <MessageCircle size={24} className="text-[#25D366] animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Checking WhatsApp numbers…</p>
              <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* DONE */}
          {state === 'done' && result && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-[#25D366]" />
                </div>
                <p className="font-semibold text-slate-800">Upload complete!</p>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-sm text-slate-500">Phone numbers found</span>
                  <span className="text-sm font-bold text-slate-800">{result.found.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-sm text-blue-700">Valid Indian numbers</span>
                  <span className="text-sm font-bold text-blue-700">{result.valid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20">
                  <div>
                    <span className="text-sm font-semibold text-[#128C7E]">WhatsApp-ready</span>
                    {!result.whatsapp_checked && <span className="ml-1.5 text-[10px] text-[#128C7E]/60">(estimated)</span>}
                    <p className="text-[11px] text-[#128C7E]/70 mt-0.5">
                      {result.whatsapp_checked
                        ? 'Verified with Meta before campaign sending'
                        : 'Meta verification was unavailable, so valid numbers are estimated'}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-[#128C7E]">{result.whatsapp.toLocaleString()}</span>
                </div>
                {result.whatsapp_checked && result.valid > 0 && result.whatsapp === 0 && (
                  <div className="flex items-start gap-2 py-2.5 px-4 rounded-xl bg-amber-50 border border-amber-100">
                    <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      We saved the valid contacts, but Meta did not confirm any number as WhatsApp-ready.
                    </p>
                  </div>
                )}
                {result.saved > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="text-sm text-emerald-700">New contacts added</span>
                    <span className="text-sm font-bold text-emerald-700">+{result.saved.toLocaleString()}</span>
                  </div>
                )}
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-sm text-slate-400">Already in your contacts</span>
                    <span className="text-sm font-bold text-slate-400">{result.skipped.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={reset}
                  className="flex-1 text-sm font-medium border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Upload Another
                </button>
                <button onClick={() => onDone(result)}
                  className="flex-1 text-sm font-semibold bg-[#25D366] text-white py-2.5 rounded-xl hover:bg-[#1aad54] transition">
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-5">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <button onClick={reset}
                className="w-full text-sm font-medium border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────

function BroadcastModal({
  whatsappCount,
  onClose,
  onSent,
}: {
  whatsappCount: number
  onClose: () => void
  onSent: (result: { sentCount: number; failedCount: number }) => void
}) {
  const [name, setName] = useState('Uploaded contacts campaign')
  const [message, setMessage] = useState('Hi {{name}}, we have an update from our store. Reply here if you need help.')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendNow() {
    if (!message.trim()) {
      setError('Write a WhatsApp message first.')
      return
    }
    setSending(true)
    setError('')

    const createRes = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || 'Uploaded contacts campaign',
        message: message.trim(),
        audience: 'all',
      }),
    })
    const created = await createRes.json().catch(() => ({})) as { campaign?: { id: string }; error?: string }
    if (!createRes.ok || !created.campaign?.id) {
      setError(created.error ?? 'Could not create campaign.')
      setSending(false)
      return
    }

    const sendRes = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: created.campaign.id }),
    })
    const sent = await sendRes.json().catch(() => ({})) as { sentCount?: number; failedCount?: number; error?: string }
    setSending(false)

    if (!sendRes.ok) {
      setError(sent.error ?? 'Could not send campaign.')
      return
    }

    onSent({ sentCount: sent.sentCount ?? 0, failedCount: sent.failedCount ?? 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <Send size={15} className="text-[#25D366]" />
            </div>
            <h2 className="font-semibold text-slate-900">Send WhatsApp message</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 px-4 py-3">
            <p className="text-sm font-semibold text-[#128C7E]">
              {whatsappCount.toLocaleString()} WhatsApp-ready contacts will receive this message
            </p>
            <p className="text-xs text-[#128C7E]/70 mt-1">
              Use {'{{name}}'} to personalize the message for saved contact names.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Campaign name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">WhatsApp message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">Avoid spammy language. Send only to customers who expect your updates.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 text-sm font-medium border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={sendNow} disabled={sending || whatsappCount === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold bg-[#25D366] text-white py-2.5 rounded-xl hover:bg-[#1aad54] disabled:opacity-50 transition">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Sending...' : 'Send now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'whatsapp' | 'no_whatsapp'

function avatarInitials(contact: Contact) {
  if (contact.name) return contact.name.slice(0, 2).toUpperCase()
  return contact.phone.slice(-2)
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

const UPLOAD_HISTORY_KEY = 'wapaci_contact_upload_history'

function uploadLabel(result: UploadResult) {
  if (result.filename) return result.filename.replace(/\.[^.]+$/, '')
  return `Upload ${new Date().toLocaleDateString()}`
}

export default function ContactsPage() {
  const [contacts, setContacts]   = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<Filter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null)
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([])
  const [sendResult, setSendResult] = useState<{ sentCount: number; failedCount: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, campaignsRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/campaigns'),
      ])
      if (contactsRes.ok) {
        const data = await contactsRes.json() as { contacts: Contact[] }
        setContacts(data.contacts ?? [])
      }
      if (campaignsRes.ok) {
        const data = await campaignsRes.json() as { campaigns: Campaign[] }
        setCampaigns(data.campaigns ?? [])
      }
    } catch { /* keep existing */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(UPLOAD_HISTORY_KEY)
      if (saved) setUploadHistory(JSON.parse(saved) as UploadHistory[])
    } catch { /* local history is optional */ }
  }, [])

  function rememberUpload(result: UploadResult) {
    const item: UploadHistory = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label: uploadLabel(result),
      uploaded_at: result.uploaded_at ?? new Date().toISOString(),
    }
    setUploadHistory(prev => {
      const next = [item, ...prev].slice(0, 6)
      try { window.localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const stats = useMemo(() => {
    const sent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0)
    const completed = campaigns.filter(c => c.status === 'completed').length
    return {
      total:    contacts.length,
      whatsapp: contacts.filter(c => c.whatsapp_opt_in).length,
      completed,
      sent,
    }
  }, [contacts, campaigns])

  const displayed = useMemo(() => {
    return contacts.filter(c => {
      if (filter === 'whatsapp' && !c.whatsapp_opt_in) return false
      if (filter === 'no_whatsapp' && c.whatsapp_opt_in) return false
      if (search) {
        const s = search.toLowerCase()
        return c.phone.includes(s) || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
      }
      return true
    })
  }, [contacts, filter, search])

  const hasContacts = contacts.length > 0
  const sendDisabledReason = stats.whatsapp === 0
    ? stats.total > 0
      ? 'No WhatsApp-ready contacts yet. Upload with WhatsApp verification or connect WhatsApp correctly.'
      : 'Upload contacts before sending a WhatsApp message.'
    : ''

  return (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={(result) => {
            setLastUpload(result)
            rememberUpload(result)
            setShowUpload(false)
            load()
          }}
        />
      )}
      {showBroadcast && (
        <BroadcastModal
          whatsappCount={stats.whatsapp}
          onClose={() => setShowBroadcast(false)}
          onSent={(result) => {
            setSendResult(result)
            setShowBroadcast(false)
            load()
          }}
        />
      )}

      <div className="p-6 lg:p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
            {hasContacts ? (
              <p className="text-slate-500 text-sm mt-1">
                <span className="font-semibold text-slate-700">{stats.total.toLocaleString()}</span> contacts ·{' '}
                <span className="font-semibold text-[#25D366]">{stats.whatsapp.toLocaleString()}</span> on WhatsApp
              </p>
            ) : (
              <p className="text-slate-400 text-sm mt-1">Upload your customer phone numbers to get started</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition" title="Refresh">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 text-sm font-semibold bg-[#25D366] text-white px-4 py-2 rounded-xl hover:bg-[#1aad54] transition shadow-sm">
              <Upload size={14} /> Upload Contacts
            </button>
            <button onClick={() => setShowBroadcast(true)} disabled={stats.whatsapp === 0} title={sendDisabledReason || 'Send WhatsApp message'}
              className="flex items-center gap-2 text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm">
              <Send size={14} /> Send WhatsApp
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 mb-5">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Contact workspace</p>
                <p className="text-sm text-slate-500 mt-1">Upload customer files, verify reachability, then send a WhatsApp campaign.</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                <ListChecks size={18} className="text-[#25D366]" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">Saved contacts</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Every valid number is saved</p>
              </div>
              <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">WhatsApp-ready</p>
                <p className="text-3xl font-bold text-[#25D366]">{stats.whatsapp.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Eligible for campaigns</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-400 mb-1">Messages sent</p>
                <p className="text-3xl font-bold text-slate-900">{stats.sent.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">{stats.completed.toLocaleString()} completed campaigns</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                stats.whatsapp > 0 ? 'bg-[#25D366]/10' : 'bg-amber-50'
              )}>
                {stats.whatsapp > 0 ? <ShieldCheck size={17} className="text-[#25D366]" /> : <Info size={17} className="text-amber-600" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {stats.whatsapp > 0 ? 'Ready to send' : 'Why sending is disabled'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {stats.whatsapp > 0
                    ? `${stats.whatsapp.toLocaleString()} contacts are marked WhatsApp-ready.`
                    : sendDisabledReason}
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  WhatsApp readiness is checked with the connected Meta WhatsApp Business API. If credentials are unavailable, uploads are treated as estimated.
                </p>
              </div>
            </div>
          </div>
        </div>

        {(lastUpload || sendResult) && (
          <div className="mb-5 space-y-3">
            {lastUpload && (
              <div className="bg-white border border-[#25D366]/20 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-[#25D366] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Last upload saved {lastUpload.saved.toLocaleString()} new contacts</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lastUpload.found.toLocaleString()} found · {lastUpload.valid.toLocaleString()} valid · {lastUpload.whatsapp.toLocaleString()} WhatsApp-ready
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBroadcast(true)} disabled={stats.whatsapp === 0} title={sendDisabledReason || 'Send this list a message'}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#128C7E] hover:text-[#075E54] disabled:opacity-50 whitespace-nowrap">
                  Send them a message <ArrowRight size={14} />
                </button>
              </div>
            )}
            {sendResult && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <MessageCircle size={19} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-800">
                  Campaign finished: <span className="font-bold">{sendResult.sentCount.toLocaleString()}</span> sent
                  {sendResult.failedCount > 0 && <> · <span className="font-bold">{sendResult.failedCount.toLocaleString()}</span> failed</>}
                </p>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-60">
            <Loader2 size={24} className="animate-spin text-[#25D366]" />
          </div>
        ) : !hasContacts ? (

          /* ── Empty state ── */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="p-7 border-b lg:border-b-0 lg:border-r border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5">
                  <Users size={24} className="text-[#25D366]" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Build your WhatsApp audience</h2>
                <p className="text-sm text-slate-500 leading-6 mb-6">
                  Upload customer phone numbers from CSV, TXT, or VCF files. Wapaci saves valid contacts first, then marks which ones are ready for WhatsApp campaigns.
                </p>
                <button onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold bg-[#25D366] text-white px-5 py-3 rounded-xl hover:bg-[#1aad54] transition shadow-md shadow-green-500/20">
                  <Upload size={16} /> Upload Contacts
                </button>
                <p className="text-xs text-slate-400 mt-3">Supports CSV, TXT, and VCF files with Indian mobile numbers.</p>
              </div>

              <div className="p-7 bg-slate-50/60">
                <p className="text-sm font-bold text-slate-900 mb-4">How this section works</p>
                <div className="space-y-3">
                  {[
                    ['Upload a list', 'Drop a file with customer names and phone numbers.'],
                    ['Save valid contacts', 'Valid numbers are stored even if WhatsApp verification returns zero.'],
                    ['Send only when ready', 'The send button unlocks after contacts are WhatsApp-ready.'],
                  ].map(([title, desc], index) => (
                    <div key={title} className="flex gap-3 rounded-xl bg-white border border-slate-100 p-3">
                      <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#128C7E] text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {uploadHistory.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent upload lists</p>
                    <div className="space-y-2">
                      {uploadHistory.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-100 p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <FolderOpen size={15} className="text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                              <p className="text-xs text-slate-400">{item.valid.toLocaleString()} valid · {item.saved.toLocaleString()} new · {item.whatsapp.toLocaleString()} WhatsApp-ready</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            {new Date(item.uploaded_at ?? Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : (

          /* ── Contacts list ── */
          <div className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={14} className="text-[#25D366]" />
                <p className="text-xs font-semibold text-slate-500">1. Upload contacts</p>
              </div>
              <p className="text-sm text-slate-700">Import CSV, TXT, or VCF files with customer phone numbers.</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={14} className="text-[#25D366]" />
                <p className="text-xs font-semibold text-slate-500">2. Verify reachability</p>
              </div>
              <p className="text-sm text-slate-700">{stats.whatsapp.toLocaleString()} contacts are ready for WhatsApp campaigns.</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Send size={14} className="text-[#25D366]" />
                <p className="text-xs font-semibold text-slate-500">3. Send message</p>
              </div>
              <button onClick={() => setShowBroadcast(true)} disabled={stats.whatsapp === 0} title={sendDisabledReason || 'Start WhatsApp campaign'}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#128C7E] hover:text-[#075E54] disabled:opacity-50">
                Start WhatsApp campaign <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {uploadHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Recent upload lists</p>
                  <p className="text-xs text-slate-400 mt-0.5">Use these summaries to keep track of each batch you imported.</p>
                </div>
                <button onClick={() => setShowUpload(true)}
                  className="text-xs font-semibold text-[#128C7E] hover:text-[#075E54]">
                  Add another list
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {uploadHistory.slice(0, 3).map(item => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center">
                        <FolderOpen size={15} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                        <p className="text-[11px] text-slate-400">{new Date(item.uploaded_at ?? Date.now()).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white border border-slate-100 px-2 py-2">
                        <p className="text-sm font-bold text-slate-800">{item.valid.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">valid</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 px-2 py-2">
                        <p className="text-sm font-bold text-emerald-600">{item.saved.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">new</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 px-2 py-2">
                        <p className="text-sm font-bold text-[#25D366]">{item.whatsapp.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">WA</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

            {/* Stats bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-100">
              <div className="px-6 py-4 border-r border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">Total contacts</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total.toLocaleString()}</p>
              </div>
              <div className="px-6 py-4 border-r border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">On WhatsApp <span className="text-slate-300">— can receive campaigns</span></p>
                <p className="text-2xl font-bold text-[#25D366]">{stats.whatsapp.toLocaleString()}</p>
              </div>
              <div className="px-6 py-4 border-r border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">Messages sent</p>
                <p className="text-2xl font-bold text-slate-800">{stats.sent.toLocaleString()}</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-medium text-slate-400 mb-1">Completed campaigns</p>
                <p className="text-2xl font-bold text-slate-800">{stats.completed.toLocaleString()}</p>
              </div>
            </div>

            {/* Filters + Search */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                {([
                  { id: 'all',          label: `All (${contacts.length})` },
                  { id: 'whatsapp',     label: `WhatsApp (${stats.whatsapp})` },
                  { id: 'no_whatsapp',  label: `Not ready (${stats.total - stats.whatsapp})` },
                ] as { id: Filter; label: string }[]).map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    className={cn('text-xs font-medium px-3 py-1.5 rounded-md transition whitespace-nowrap',
                      filter === f.id ? 'bg-[#25D366] text-white' : 'text-slate-500 hover:text-slate-700')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30" />
              </div>
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_160px_100px] gap-4 px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/30">
              <div>Contact</div>
              <div>Phone</div>
              <div>Status</div>
            </div>

            {/* Rows */}
            {displayed.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">No contacts match your search</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {displayed.slice(0, 200).map(c => (
                  <div key={c.id} className="grid grid-cols-[1fr_160px_100px] items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', avatarColor(c.phone))}>
                        {avatarInitials(c)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {c.name ?? <span className="text-slate-400 italic font-normal">No name</span>}
                        </p>
                        {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 font-mono min-w-0">
                      <Phone size={11} className="text-slate-300 flex-shrink-0" />
                      <span className="truncate text-xs">{c.phone}</span>
                    </div>
                    <div>
                      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        c.whatsapp_opt_in
                          ? 'bg-[#25D366]/10 text-[#128C7E]'
                          : 'bg-slate-100 text-slate-400')}>
                        {c.whatsapp_opt_in
                          ? <><MessageCircle size={9} /> Ready</>
                          : 'Not ready'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {displayed.length > 200 && (
              <div className="px-5 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
                Showing 200 of {displayed.length.toLocaleString()} — use search to narrow down
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </>
  )
}

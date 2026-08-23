'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Users, Search, Upload, Loader2, X, FileText, AlertCircle,
  CheckCircle2, MessageCircle, RefreshCw, Send, CheckCircle,
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

interface Campaign {
  id: string
  status: string
  sent_count: number
  failed_count?: number
}

type UploadState = 'idle' | 'reading' | 'uploading' | 'done' | 'error'

function listName(result: UploadResult) {
  if (result.filename) return result.filename.replace(/\.[^.]+$/, '')
  return `Contact list ${new Date().toLocaleDateString()}`
}

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

// ── Upload Modal ───────────────────────────────────────────────────────────────

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: (result: UploadResult) => void }) {
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
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
      setResult(await res.json() as UploadResult)
      setState('done')
    } catch {
      setError('Network error. Check your connection and try again.')
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Upload contact list</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {state === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition',
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                )}
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Drop your sheet here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 inline-block">
                  CSV · TXT · VCF
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt,.vcf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
            </>
          )}

          {(state === 'reading' || state === 'uploading') && (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">
                {state === 'reading' ? 'Reading sheet…' : 'Syncing contacts…'}
              </p>
            </div>
          )}

          {state === 'done' && result && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="font-semibold text-gray-800">{listName(result)} synced</p>
              </div>
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-sm text-gray-500">Numbers found</span>
                  <span className="text-sm font-bold text-gray-800">{result.found.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-sm text-blue-700">Valid contacts</span>
                  <span className="text-sm font-bold text-blue-700">{result.valid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-green-50 border border-green-100">
                  <span className="text-sm text-green-700">New contacts saved</span>
                  <span className="text-sm font-bold text-green-700">+{result.saved.toLocaleString()}</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-sm text-gray-400">Already saved</span>
                    <span className="text-sm font-bold text-gray-400">{result.skipped.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={reset}
                  className="flex-1 text-sm font-medium border border-gray-200 text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition">
                  Upload another
                </button>
                <button onClick={() => onDone(result)}
                  className="flex-1 text-sm font-semibold bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition">
                  Done
                </button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <button onClick={reset}
                className="w-full text-sm font-medium border border-gray-200 text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Broadcast Modal ────────────────────────────────────────────────────────────

function BroadcastModal({ contactCount, onClose, onSent }: {
  contactCount: number
  onClose: () => void
  onSent: (result: { sentCount: number; failedCount: number }) => void
}) {
  const [name, setName] = useState('Contacts broadcast')
  const [message, setMessage] = useState('Hi {{name}}, we have an update from our store. Reply here if you need help.')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendNow() {
    if (!message.trim()) { setError('Write a WhatsApp message first.'); return }
    setSending(true)
    setError('')
    const createRes = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'Contacts broadcast', message: message.trim(), audience: 'all' }),
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
    if (!sendRes.ok) { setError(sent.error ?? 'Could not send campaign.'); return }
    onSent({ sentCount: sent.sentCount ?? 0, failedCount: sent.failedCount ?? 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Send WhatsApp message</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">
              {contactCount.toLocaleString()} synced contacts selected
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Campaign name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
            <p className="text-xs text-gray-400 mt-1">Use {'{{name}}'} to personalise saved contact names.</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 text-sm font-medium border border-gray-200 text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={sendNow} disabled={sending || contactCount === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts]         = useState<Contact[]>([])
  const [campaigns, setCampaigns]       = useState<Campaign[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [activeTab, setActiveTab]       = useState<'all' | 'opted-in' | 'opted-out'>('all')
  const [showUpload, setShowUpload]     = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [banner, setBanner]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

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
    } catch { /* keep current UI */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const optedIn   = contacts.filter(c => c.whatsapp_opt_in).length
    const sent      = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0)
    const completed = campaigns.filter(c => c.status === 'completed').length
    return { total: contacts.length, optedIn, sent, completed }
  }, [contacts, campaigns])

  const tabCounts = useMemo(() => ({
    all:       contacts.length,
    'opted-in':  contacts.filter(c => c.whatsapp_opt_in).length,
    'opted-out': contacts.filter(c => !c.whatsapp_opt_in).length,
  }), [contacts])

  const displayed = useMemo(() => {
    let list = contacts
    if (activeTab === 'opted-in')  list = list.filter(c => c.whatsapp_opt_in)
    if (activeTab === 'opted-out') list = list.filter(c => !c.whatsapp_opt_in)
    const needle = search.toLowerCase()
    if (!needle) return list
    return list.filter(c =>
      c.phone.includes(needle) ||
      c.name?.toLowerCase().includes(needle) ||
      c.email?.toLowerCase().includes(needle)
    )
  }, [contacts, search, activeTab])

  return (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={result => {
            setShowUpload(false)
            load()
            setBanner({ type: 'success', msg: `${result.saved} new contacts saved (${result.skipped} already existed)` })
          }}
        />
      )}

      {showBroadcast && (
        <BroadcastModal
          contactCount={stats.total}
          onClose={() => setShowBroadcast(false)}
          onSent={result => {
            setShowBroadcast(false)
            load()
            setBanner({
              type: 'success',
              msg: `Campaign sent — ${result.sentCount} delivered${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}`,
            })
          }}
        />
      )}

      <div className="p-6 lg:p-8 space-y-5">

        {/* Banner */}
        {banner && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {banner.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1">{banner.msg}</span>
            <button onClick={() => setBanner(null)}>
              <X className="w-4 h-4 opacity-50 hover:opacity-100 transition" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {stats.total.toLocaleString()} contacts saved
              {stats.completed > 0 && ` · ${stats.completed} campaign${stats.completed !== 1 ? 's' : ''} completed`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load}
              className="p-2 text-gray-400 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition"
              title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition">
              <Upload className="w-4 h-4" /> Upload
            </button>
            <button onClick={() => setShowBroadcast(true)} disabled={stats.total === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              <Send className="w-4 h-4" /> Send message
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total contacts', value: stats.total,   color: '#6b7280' },
            { label: 'WhatsApp opt-in', value: stats.optedIn, color: '#10b981' },
            { label: 'Messages sent',   value: stats.sent,    color: '#3b82f6' },
            { label: 'Campaigns done',  value: stats.completed, color: '#f59e0b' },
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

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Tab bar — mirrors Leads page structure */}
          <div className="flex items-center border-b border-gray-100 overflow-x-auto">
            {([
              { id: 'all',       label: 'All contacts' },
              { id: 'opted-in',  label: 'Opted in' },
              { id: 'opted-out', label: 'Opted out' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch('') }}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-gray-800 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.id ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'
                }`}>
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/40">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, email…"
                className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {search && (
              <p className="text-xs text-gray-400">{displayed.length.toLocaleString()} result{displayed.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-gray-200" />
              </div>
              <p className="text-sm text-gray-400">No contacts yet</p>
              <p className="text-xs text-gray-300 mt-1">Upload a CSV, TXT, or VCF to get started</p>
              <button onClick={() => setShowUpload(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
                <Upload className="w-4 h-4" /> Upload contacts
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              {search ? (
                <>
                  <p className="text-sm text-gray-400">No contacts matching &quot;{search}&quot;</p>
                  <button onClick={() => setSearch('')} className="mt-2 text-xs text-blue-500 hover:underline">Clear search</button>
                </>
              ) : (
                <p className="text-sm text-gray-400">
                  {activeTab === 'opted-in' ? 'No opted-in contacts yet' : 'No opted-out contacts'}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">WhatsApp</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Added</th>
                    <th className="px-5 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayed.slice(0, 200).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', avatarColor(c.phone))}>
                            {avatarInitials(c)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {c.name ?? <span className="text-gray-400 font-normal italic">No name</span>}
                            </p>
                            {c.email && <p className="text-xs text-gray-400 truncate mt-0.5">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-600 font-mono">{c.phone}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.whatsapp_opt_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.whatsapp_opt_in ? 'Opted in' : 'Opted out'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setShowBroadcast(true)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-600 transition"
                          title="Send WhatsApp broadcast">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {displayed.length > 200 && (
            <div className="px-5 py-3 border-t border-gray-100 text-center text-xs text-gray-400">
              Showing 200 of {displayed.length.toLocaleString()} contacts · use search to filter
            </div>
          )}
        </div>
      </div>
    </>
  )
}

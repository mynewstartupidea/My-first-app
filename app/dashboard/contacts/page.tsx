'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Users, Search, Upload, Loader2, Phone, X, FileText, AlertCircle,
  CheckCircle2, MessageCircle, RefreshCw, Send, FolderOpen, Edit3
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

interface ContactList extends UploadResult {
  id: string
  label: string
}

interface Campaign {
  id: string
  status: string
  sent_count: number
  failed_count?: number
}

type UploadState = 'idle' | 'reading' | 'uploading' | 'done' | 'error'

const LIST_STORAGE_KEY = 'wapaci_contact_upload_history'

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

      const data = await res.json() as UploadResult
      setResult(data)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <Upload size={15} className="text-[#25D366]" />
            </div>
            <h2 className="font-semibold text-slate-900">Upload contact list</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {state === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) processFile(file)
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition',
                  dragOver ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-[#25D366]/50 hover:bg-slate-50'
                )}
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Drop your sheet here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 inline-block">
                  CSV · TXT · VCF
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.vcf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) processFile(file)
                }}
              />
            </>
          )}

          {(state === 'reading' || state === 'uploading') && (
            <div className="text-center py-10">
              <Loader2 size={32} className="animate-spin text-[#25D366] mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                {state === 'reading' ? 'Reading sheet...' : 'Syncing contacts...'}
              </p>
            </div>
          )}

          {state === 'done' && result && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-[#25D366]" />
                </div>
                <p className="font-semibold text-slate-800">{listName(result)} synced</p>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-sm text-slate-500">Numbers found</span>
                  <span className="text-sm font-bold text-slate-800">{result.found.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-sm text-blue-700">Valid contacts</span>
                  <span className="text-sm font-bold text-blue-700">{result.valid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-sm text-emerald-700">New contacts saved</span>
                  <span className="text-sm font-bold text-emerald-700">+{result.saved.toLocaleString()}</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-sm text-slate-400">Already saved</span>
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

function BroadcastModal({
  contactCount,
  onClose,
  onSent,
}: {
  contactCount: number
  onClose: () => void
  onSent: (result: { sentCount: number; failedCount: number }) => void
}) {
  const [name, setName] = useState('Contacts broadcast')
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
        name: name.trim() || 'Contacts broadcast',
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
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">
              {contactCount.toLocaleString()} synced contacts selected
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
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">Use {'{{name}}'} to personalize saved contact names.</p>
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
            <button onClick={sendNow} disabled={sending || contactCount === 0}
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null)
  const [lists, setLists] = useState<ContactList[]>([])
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
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
    } catch { /* keep current UI */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LIST_STORAGE_KEY)
      if (saved) setLists(JSON.parse(saved) as ContactList[])
    } catch { /* local list names are optional */ }
  }, [])

  function persistLists(next: ContactList[]) {
    setLists(next)
    try { window.localStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function rememberUpload(result: UploadResult) {
    const item: ContactList = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label: listName(result),
      uploaded_at: result.uploaded_at ?? new Date().toISOString(),
    }
    persistLists([item, ...lists].slice(0, 8))
  }

  function renameList(id: string, label: string) {
    const clean = label.trim()
    if (!clean) return
    persistLists(lists.map(item => item.id === id ? { ...item, label: clean } : item))
    setEditingListId(null)
    setEditingLabel('')
  }

  const stats = useMemo(() => {
    const sent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0)
    const completed = campaigns.filter(c => c.status === 'completed').length
    return { total: contacts.length, sent, completed }
  }, [contacts, campaigns])

  const displayed = useMemo(() => {
    const needle = search.toLowerCase()
    return contacts.filter(c => {
      if (!needle) return true
      return c.phone.includes(needle) || c.name?.toLowerCase().includes(needle) || c.email?.toLowerCase().includes(needle)
    })
  }, [contacts, search])

  const listCards: ContactList[] = lists.length > 0
    ? lists
    : stats.total > 0
      ? [{
          id: 'all',
          label: 'All synced contacts',
          found: stats.total,
          valid: stats.total,
          whatsapp: stats.total,
          saved: stats.total,
          skipped: 0,
          whatsapp_checked: false,
        }]
      : []

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
          contactCount={stats.total}
          onClose={() => setShowBroadcast(false)}
          onSent={(result) => {
            setSendResult(result)
            setShowBroadcast(false)
            load()
          }}
        />
      )}

      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-400 text-sm mt-1">Upload lists, organize contacts, and send broadcasts</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition" title="Refresh">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 text-sm font-semibold bg-[#25D366] text-white px-4 py-2 rounded-xl hover:bg-[#1aad54] transition shadow-sm">
              <Upload size={14} /> Upload
            </button>
            <button onClick={() => setShowBroadcast(true)} disabled={stats.total === 0}
              className="flex items-center gap-2 text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm">
              <Send size={14} /> Send
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          <aside className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total synced</p>
              <p className="text-4xl font-bold text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">contacts saved</p>
              <button onClick={() => setShowBroadcast(true)} disabled={stats.total === 0}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
                <Send size={14} /> Send message
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-900">Lists</p>
                <button onClick={() => setShowUpload(true)}
                  className="text-xs font-semibold text-[#128C7E] hover:text-[#075E54]">
                  Upload
                </button>
              </div>

              {listCards.length === 0 ? (
                <button onClick={() => setShowUpload(true)}
                  className="w-full border border-dashed border-slate-200 rounded-xl p-4 text-left hover:border-[#25D366]/50 hover:bg-slate-50 transition">
                  <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center mb-3">
                    <Upload size={16} className="text-[#25D366]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Upload first list</p>
                  <p className="text-xs text-slate-400 mt-1">CSV, TXT, or VCF</p>
                </button>
              ) : (
                <div className="space-y-2">
                  {listCards.map(item => (
                    <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <FolderOpen size={16} className="text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {editingListId === item.id ? (
                            <form onSubmit={e => { e.preventDefault(); renameList(item.id, editingLabel) }}>
                              <input
                                autoFocus
                                value={editingLabel}
                                onChange={e => setEditingLabel(e.target.value)}
                                onBlur={() => renameList(item.id, editingLabel)}
                                className="w-full text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#25D366]/20"
                              />
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                              {item.id !== 'all' && (
                                <button onClick={() => { setEditingListId(item.id); setEditingLabel(item.label) }}
                                  className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                                  <Edit3 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">{item.valid.toLocaleString()} contacts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Contact library</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {stats.sent.toLocaleString()} messages sent · {stats.completed.toLocaleString()} completed campaigns
                  </p>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search contacts"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                  />
                </div>
              </div>
            </div>

            {(lastUpload || sendResult) && (
              <div className="space-y-3">
                {lastUpload && (
                  <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-[#25D366] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{listName(lastUpload)} synced</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lastUpload.valid.toLocaleString()} contacts · {lastUpload.saved.toLocaleString()} new · {lastUpload.skipped.toLocaleString()} already saved
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowBroadcast(true)} disabled={stats.total === 0}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#128C7E] hover:text-[#075E54] disabled:opacity-50 whitespace-nowrap">
                      Send message
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
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm h-80 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#25D366]" />
              </div>
            ) : stats.total === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-[#25D366]" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">No contacts yet</h2>
                <p className="text-sm text-slate-400 mt-2 mb-6">Upload a sheet to create your first contact list.</p>
                <button onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold bg-[#25D366] text-white px-5 py-3 rounded-xl hover:bg-[#1aad54] transition shadow-md shadow-green-500/20">
                  <Upload size={16} /> Upload Contacts
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_170px_100px] gap-4 px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/60">
                  <div>Contact</div>
                  <div>Phone</div>
                  <div>Status</div>
                </div>

                {displayed.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No contacts match your search</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {displayed.slice(0, 200).map(c => (
                      <div key={c.id} className="grid grid-cols-[1fr_170px_100px] items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition">
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
                        <span className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Synced
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {displayed.length > 200 && (
                  <div className="px-5 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
                    Showing 200 of {displayed.length.toLocaleString()} contacts
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}

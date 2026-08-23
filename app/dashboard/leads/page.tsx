'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Facebook, RefreshCw, MessageCircle, Users, ChevronDown, ChevronUp,
  CheckCircle, X, Zap, Save, Plus, ChevronRight, ChevronLeft,
  Loader2, Pause, Play, Search, Edit2, Download,
  AlertCircle, FileText, LogOut,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Page {
  id: string
  page_id: string
  page_name: string
  store_id: string | null
}

interface FBForm {
  id: string
  name: string
  status: string
}

interface ActiveForm {
  id: string
  form_id: string
  form_name: string
  connection_id: string
  page_id: string
  message_template: string
  is_enabled: boolean
  color_index: number
  lead_count: number
  last_lead_fetch: string | null
}

interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  form_id: string | null
  form_name: string | null
  page_id: string | null
  wa_status: string
  created_at: string
  fields: Record<string, string> | null
}

// ── Colors ────────────────────────────────────────────────────────────────────

const COLORS = [
  { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  { dot: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  { dot: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  { dot: '#f97316', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  { dot: '#ec4899', bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' },
  { dot: '#06b6d4', bg: '#ecfeff', text: '#155e75', border: '#a5f3fc' },
  { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  { dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
]

const getColor = (i: number) => COLORS[i % COLORS.length]

const DEFAULT_TEMPLATE = `Hi {{name}}! 👋

We received your inquiry and will be in touch shortly.

Let us know if you have any questions!`

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; cls: string }> = {
    sent:     { label: 'Sent',       cls: 'bg-green-100 text-green-700' },
    pending:  { label: 'Pending',    cls: 'bg-amber-100 text-amber-700' },
    failed:   { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
    no_phone: { label: 'No phone',   cls: 'bg-gray-100 text-gray-500' },
    imported: { label: 'Historical', cls: 'bg-slate-100 text-slate-500' },
  }
  const v = variants[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.cls}`}>
      {v.label}
    </span>
  )
}

// ── SyncingScreen (Suspense fallback only) ────────────────────────────────────

function SyncingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
          <Facebook className="w-6 h-6 text-white" />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-sm text-gray-400">Loading Lead Ads…</p>
    </div>
  )
}

// ── PageDropdown ──────────────────────────────────────────────────────────────

function PageDropdown({ pages, selectedId, onSelect, onDisconnectAll, onReconnect }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onDisconnectAll: () => void
  onReconnect: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = pages.find(p => p.page_id === selectedId)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition max-w-[220px]"
      >
        <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
          <Facebook className="w-3 h-3 text-blue-600" />
        </div>
        <span className="truncate">{selected?.page_name ?? 'Select page'}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="py-1 max-h-52 overflow-y-auto">
            {pages.map(p => (
              <button key={p.page_id} onClick={() => { onSelect(p); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition ${selectedId === p.page_id ? 'bg-blue-50' : ''}`}>
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Facebook className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className={`flex-1 truncate ${selectedId === p.page_id ? 'font-medium text-blue-700' : 'text-gray-700'}`}>{p.page_name}</span>
                {selectedId === p.page_id && <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 py-1">
            <button onClick={() => { onReconnect(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition">
              <RefreshCw className="w-4 h-4" /> Reconnect Facebook
            </button>
            <button onClick={() => { onDisconnectAll(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
              <X className="w-4 h-4" /> Disconnect all pages
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ActivateFormModal ─────────────────────────────────────────────────────────

function ActivateFormModal({ selectedPageId, activeForms, preSelectedForm, onClose, onActivate }: {
  selectedPageId: string | null
  activeForms: ActiveForm[]
  preSelectedForm?: FBForm | null
  onClose: () => void
  onActivate: (connectionId: string, form: FBForm, template: string) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [pageForms, setPageForms] = useState<FBForm[] | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
  const [loadingForms, setLoadingForms] = useState(false)
  const [selectedForm, setSelectedForm] = useState<FBForm | null>(preSelectedForm ?? null)
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [activating, setActivating] = useState(false)

  const activatedIds = new Set(activeForms.map(f => f.form_id))

  useEffect(() => {
    if (!selectedPageId) return
    setLoadingForms(true)
    fetch(`/api/facebook/pages?page_id=${selectedPageId}`)
      .then(r => r.json())
      .then((d: { forms?: FBForm[]; connectionId?: string | null; whatsapp_connected?: boolean }) => {
        setPageForms(d.forms ?? [])
        setConnectionId(d.connectionId ?? null)
        setWhatsappConnected(d.whatsapp_connected ?? false)
      })
      .finally(() => setLoadingForms(false))
  }, [selectedPageId])

  const filtered = (pageForms ?? []).filter(
    f => !activatedIds.has(f.id) && f.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleActivate = async () => {
    if (!selectedForm || !connectionId) return
    setActivating(true)
    try { await onActivate(connectionId, selectedForm, template); onClose() }
    finally { setActivating(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Activate a lead form</h2>
            <p className="text-sm text-gray-400 mt-0.5">Pick a form to monitor for new leads</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!selectedForm ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search forms…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingForms ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">
                    {pageForms === null ? 'Loading…' : search ? 'No matching forms' : 'All forms are already activated'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map(f => (
                    <button key={f.id} onClick={() => setSelectedForm(f)}
                      className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-gray-50 transition group">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">{f.status?.toLowerCase()}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              {!preSelectedForm && (
                <button onClick={() => setSelectedForm(null)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition mb-3">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  All forms
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedForm.name}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{selectedForm.status?.toLowerCase()}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* WhatsApp not connected warning */}
              {whatsappConnected === false && !loadingForms && (
                <div className="mb-4 flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">WhatsApp not connected</p>
                    <p className="text-xs text-amber-700 mt-0.5">Connect your WhatsApp account so messages can be sent to leads.</p>
                    <a href="/dashboard/settings?tab=whatsapp"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900">
                      Connect WhatsApp →
                    </a>
                  </div>
                </div>
              )}
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp message template</label>
              <p className="text-xs text-gray-400 mb-3">
                Use{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">{'{{name}}'}</code>{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">{'{{phone}}'}</code>{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">{'{{email}}'}</code>{' '}
                and any custom field names from your form.
              </p>
              <textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={7}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="mt-3 flex items-start gap-2 p-3 bg-green-50 rounded-xl">
                <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  Existing leads with phone numbers will be messaged immediately.
                  All future leads will get your message automatically.
                </p>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100">
              {whatsappConnected === false && !loadingForms ? (
                <a href="/dashboard/settings?tab=whatsapp"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition">
                  <MessageCircle className="w-4 h-4" /> Connect WhatsApp first
                </a>
              ) : (
                <button onClick={handleActivate} disabled={activating || loadingForms || !connectionId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
                  {(activating || loadingForms) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {activating ? 'Activating…' : loadingForms ? 'Loading…' : `Activate "${selectedForm.name}"`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── EditFormModal ─────────────────────────────────────────────────────────────

function EditFormModal({ form, onClose, onSave }: {
  form: ActiveForm
  onClose: () => void
  onSave: (template: string) => Promise<void>
}) {
  const [template, setTemplate] = useState(form.message_template)
  const [saving, setSaving] = useState(false)
  const c = getColor(form.color_index)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(template); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: c.dot }} />
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-[300px]">{form.form_name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp message template</label>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            rows={8}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ImportModal ───────────────────────────────────────────────────────────────

function ImportModal({ form, onClose, onImport }: {
  form: ActiveForm
  onClose: () => void
  onImport: (fromDate: string, toDate: string) => Promise<{ imported: number }>
}) {
  const today = new Date().toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState(today)
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<number | null>(null)
  const c = getColor(form.color_index)

  const handleImport = async () => {
    if (!fromDate) return
    setImporting(true)
    try { const r = await onImport(fromDate, toDate); setResult(r.imported) }
    finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: c.dot }} />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Import older leads</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[250px]">{form.form_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          {result !== null ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{result}</p>
              <p className="text-sm text-gray-500">leads imported for reference</p>
              <p className="text-xs text-gray-400 mt-2">These won&apos;t trigger WhatsApp messages.</p>
              <button onClick={onClose} className="mt-5 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition">Done</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-5">
                Choose a date range to import historical leads. These are for reference only — no WhatsApp messages will be sent.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">From date</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">To date</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={today}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button onClick={handleImport} disabled={importing || !fromDate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import leads'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── LeadRow ───────────────────────────────────────────────────────────────────

const STANDARD_KEYS = new Set([
  'name', 'email', 'phone', 'full_name', 'first_name', 'last_name', 'phone_number', 'mobile',
])

function LeadRow({ lead, activeForms, showFormBadge, onWhatsApp }: {
  lead: Lead
  activeForms: ActiveForm[]
  showFormBadge: boolean
  onWhatsApp: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const form  = activeForms.find(f => f.form_id === lead.form_id)
  const color = form ? getColor(form.color_index) : null
  const extra = Object.entries(lead.fields ?? {}).filter(([k]) => !STANDARD_KEYS.has(k))

  return (
    <>
      <tr className="hover:bg-gray-50/40 transition-colors">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color.dot }} />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{lead.name ?? '—'}</p>
              {lead.email && <p className="text-xs text-gray-400 truncate mt-0.5">{lead.email}</p>}
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className="text-xs text-gray-600 font-mono">{lead.phone ?? '—'}</span>
        </td>
        {showFormBadge && (
          <td className="px-5 py-3.5">
            {color && form ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium max-w-[160px]"
                style={{ background: color.bg, color: color.text }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.dot }} />
                <span className="truncate">{form.form_name}</span>
              </span>
            ) : (
              <span className="text-xs text-gray-400 block max-w-[200px] truncate" title={lead.form_name ?? undefined}>{lead.form_name ?? '—'}</span>
            )}
          </td>
        )}
        <td className="px-5 py-3.5"><StatusBadge status={lead.wa_status} /></td>
        <td className="px-5 py-3.5">
          <span className="text-xs text-gray-400">
            {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1">
            {lead.phone && lead.wa_status !== 'sent' && (
              <button onClick={onWhatsApp}
                className={`p-1.5 rounded-lg transition ${
                  lead.wa_status === 'pending'
                    ? 'text-amber-300 hover:bg-amber-50 hover:text-amber-600'
                    : 'text-gray-300 hover:bg-green-50 hover:text-green-600'
                }`}
                title={lead.wa_status === 'pending' ? 'Resend WhatsApp' : 'Send WhatsApp'}>
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            {extra.length > 0 && (
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && extra.length > 0 && (
        <tr>
          <td colSpan={showFormBadge ? 6 : 5} className="px-5 pb-4">
            <div className="ml-5 bg-gray-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {extra.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400 capitalize mb-0.5">{k.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium text-gray-800">{v}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── AllFormsView ──────────────────────────────────────────────────────────────

function AllFormsView({ pageId, activeForms, togglingId, onActivate, onEdit, onImport, onToggle }: {
  pageId: string | null
  activeForms: ActiveForm[]
  togglingId: string | null
  onActivate: (form: FBForm) => void
  onEdit: (form: ActiveForm) => void
  onImport: (form: ActiveForm) => void
  onToggle: (form: ActiveForm, enabled: boolean) => void
}) {
  const [forms, setForms] = useState<FBForm[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!pageId) return
    setLoading(true)
    setForms(null)
    fetch(`/api/facebook/pages?page_id=${pageId}`)
      .then(r => r.json())
      .then((d: { forms?: FBForm[] }) => setForms(d.forms ?? []))
      .finally(() => setLoading(false))
  }, [pageId])

  const activeMap = new Map(activeForms.map(f => [f.form_id, f]))
  const filtered = (forms ?? []).filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            placeholder="Search forms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-gray-400 ml-auto">
          {forms !== null ? `${filtered.length} form${filtered.length !== 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        </div>
      ) : forms === null ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">{search ? 'No forms match your search' : 'No forms found for this page'}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filtered.map(f => {
            const af = activeMap.get(f.id)
            const c = af ? getColor(af.color_index) : null
            return (
              <div key={f.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: c?.dot ?? '#e5e7eb' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={f.name}>{f.name}</p>
                    {af ? (
                      <p className="text-xs mt-0.5">
                        <span className="text-gray-400">{af.lead_count} leads · </span>
                        <span style={{ color: af.is_enabled ? '#16a34a' : '#9ca3af' }}>
                          {af.is_enabled ? 'Active' : 'Paused'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Not activated</p>
                    )}
                  </div>
                </div>
                {af ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => !togglingId && onToggle(af, !af.is_enabled)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
                      title={af.is_enabled ? 'Pause' : 'Resume'}>
                      {togglingId === af.form_id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : af.is_enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => onImport(af)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600" title="Import older leads">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => onEdit(af)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600" title="Edit template">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onActivate(f)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                    <Zap className="w-3 h-3" /> Activate
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── LeadsContent ──────────────────────────────────────────────────────────────

function LeadsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [pagesLoaded,    setPagesLoaded]    = useState(false)
  const [loadingForms,   setLoadingForms]   = useState(false)
  const [loadingLeads,   setLoadingLeads]   = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)
  const [pages,          setPages]          = useState<Page[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('_wpl_pages') ?? 'null') ?? [] } catch { return [] }
  })
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('_wpl_pid') } catch { return null }
  })
  const [activeForms,    setActiveForms]    = useState<ActiveForm[]>([])
  const [leads,          setLeads]          = useState<Lead[]>([])
  const [total,          setTotal]          = useState(0)
  const [pageStats,      setPageStats]      = useState({ total: 0, withPhone: 0, sent: 0, pending: 0 })
  const [perPage,        setPerPage]        = useState<25 | 50 | 100>(50)
  const [currentPage,    setCurrentPage]    = useState(1)
  const [leadSearch,     setLeadSearch]     = useState('')
  const [selectedFormId, setSelectedFormId] = useState<string | 'all' | '__forms'>('all')
  const [banner,         setBanner]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showActivate,   setShowActivate]   = useState(false)
  const [preActivateForm,setPreActivateForm]= useState<FBForm | null>(null)
  const [editingForm,    setEditingForm]    = useState<ActiveForm | null>(null)
  const [importingForm,  setImportingForm]  = useState<ActiveForm | null>(null)
  const [togglingId,     setTogglingId]     = useState<string | null>(null)

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchPages = useCallback(async () => {
    const r = await fetch('/api/facebook/pages')
    const d = await r.json() as { pages?: Page[] }
    const p = d.pages ?? []
    setPages(p)
    try { sessionStorage.setItem('_wpl_pages', JSON.stringify(p)) } catch {}
    return p
  }, [])

  const fetchActiveForms = useCallback(async (pageId: string) => {
    const r = await fetch(`/api/facebook/active-forms?page_id=${pageId}`)
    const d = await r.json() as { forms?: ActiveForm[] }
    setActiveForms(d.forms ?? [])
  }, [])

  const fetchStats = useCallback(async (pageId: string) => {
    const r = await fetch(`/api/facebook/leads/stats?page_id=${pageId}`)
    const d = await r.json() as { total?: number; withPhone?: number; sent?: number; pending?: number }
    setPageStats({ total: d.total ?? 0, withPhone: d.withPhone ?? 0, sent: d.sent ?? 0, pending: d.pending ?? 0 })
  }, [])

  const fetchLeads = useCallback(async (
    formId: string | 'all',
    pageId: string,
    page = 1,
    pPerPage = 50,
    search = '',
  ) => {
    const p = new URLSearchParams({ limit: String(pPerPage), offset: String((page - 1) * pPerPage) })
    if (formId !== 'all' && formId !== '__forms') p.set('form_id', formId)
    else p.set('page_id', pageId)
    if (search.trim()) p.set('q', search.trim())
    const r = await fetch(`/api/facebook/leads?${p}`)
    const d = await r.json() as { leads?: Lead[]; total?: number }
    setLeads(d.leads ?? [])
    setTotal(d.total ?? 0)
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoadingForms(true)
      setLoadingLeads(true)

      const fb = searchParams.get('fb')
      if (fb === 'connected') {
        const n = searchParams.get('pages') ?? '0'
        setBanner({ type: 'success', msg: `${n} Facebook page${+n !== 1 ? 's' : ''} connected` })
        router.replace('/dashboard/leads')
      } else if (fb === 'denied') {
        setBanner({ type: 'error', msg: 'Facebook connection was cancelled.' })
      } else if (fb === 'error') {
        setBanner({ type: 'error', msg: 'Failed to connect Facebook. Please try again.' })
      }

      let cachedPageId: string | null = null
      try { cachedPageId = sessionStorage.getItem('_wpl_pid') } catch {}

      const [p] = await Promise.all([
        fetchPages(),
        ...(cachedPageId ? [fetchActiveForms(cachedPageId), fetchLeads('all', cachedPageId), fetchStats(cachedPageId)] : []),
      ]) as [Page[], ...unknown[]]

      setPagesLoaded(true)

      if (p.length > 0) {
        // Restore the previously selected page if it still exists; otherwise fall back to first
        const savedPageIsValid = cachedPageId && p.some(pg => pg.page_id === cachedPageId)
        const pageId = savedPageIsValid ? cachedPageId! : p[0].page_id
        setSelectedPageId(pageId)
        try { sessionStorage.setItem('_wpl_pid', pageId) } catch {}
        if (pageId !== cachedPageId) {
          await Promise.all([fetchActiveForms(pageId), fetchLeads('all', pageId), fetchStats(pageId)])
        }
      }

      setLoadingForms(false)
      setLoadingLeads(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePageChange = async (page: Page) => {
    setSelectedPageId(page.page_id)
    setSelectedFormId('all')
    setCurrentPage(1)
    setLeadSearch('')
    setLeads([])
    setActiveForms([])
    setLoadingForms(true)
    setLoadingLeads(true)
    try { sessionStorage.setItem('_wpl_pid', page.page_id) } catch {}
    await Promise.all([fetchActiveForms(page.page_id), fetchLeads('all', page.page_id, 1, perPage, ''), fetchStats(page.page_id)])
    setLoadingForms(false)
    setLoadingLeads(false)
  }

  const handleTabChange = async (formId: string | 'all' | '__forms') => {
    setSelectedFormId(formId)
    setCurrentPage(1)
    setLeadSearch('')
    setLeads([])
    if (formId === '__forms') return
    if (selectedPageId) {
      setLoadingLeads(true)
      await fetchLeads(formId, selectedPageId, 1, perPage, '')
      setLoadingLeads(false)
    }
  }

  const handleActivate = async (connectionId: string, form: FBForm, template: string) => {
    const r = await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, formId: form.id, formName: form.name, messageTemplate: template, isEnabled: true }),
    })
    const d = await r.json() as { ok?: boolean; leadsFetched?: number; leadsQueued?: number }
    if (selectedPageId) {
      await Promise.all([
        fetchActiveForms(selectedPageId),
        fetchStats(selectedPageId),
        ...(selectedFormId !== '__forms' ? [fetchLeads(selectedFormId, selectedPageId, 1, perPage, leadSearch)] : []),
      ])
      const msg = d.leadsQueued
        ? `"${form.name}" activated — ${d.leadsQueued} leads queued for WhatsApp`
        : d.leadsFetched
          ? `"${form.name}" activated — ${d.leadsFetched} leads imported`
          : `"${form.name}" activated`
      setBanner({ type: 'success', msg })
    }
  }

  const handleToggle = async (form: ActiveForm, enabled: boolean) => {
    setTogglingId(form.form_id)
    await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: form.connection_id, formId: form.form_id, formName: form.form_name, messageTemplate: form.message_template, isEnabled: enabled }),
    })
    if (selectedPageId) await fetchActiveForms(selectedPageId)
    setTogglingId(null)
  }

  const handleEditSave = async (template: string) => {
    if (!editingForm) return
    await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: editingForm.connection_id, formId: editingForm.form_id, formName: editingForm.form_name, messageTemplate: template, isEnabled: editingForm.is_enabled }),
    })
    if (selectedPageId) await fetchActiveForms(selectedPageId)
  }

  const handleImport = async (form: ActiveForm, fromDate: string, toDate: string) => {
    const r = await fetch('/api/facebook/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: form.connection_id, formId: form.form_id, fromDate, toDate }),
    })
    const d = await r.json() as { imported?: number }
    if (selectedPageId) {
      await Promise.all([
        fetchActiveForms(selectedPageId),
        fetchStats(selectedPageId),
        ...(selectedFormId !== '__forms' ? [fetchLeads(selectedFormId, selectedPageId, 1, perPage, leadSearch)] : []),
      ])
    }
    return { imported: d.imported ?? 0 }
  }

  const handleSendWhatsApp = async (lead: Lead) => {
    const r = await fetch('/api/facebook/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, message: '' }),
    })
    if (!r.ok) {
      const d = await r.json() as { error?: string }
      setBanner({ type: 'error', msg: d.error ?? 'Failed to queue WhatsApp message' })
      return
    }
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, wa_status: 'pending' } : l))
    if (selectedPageId) fetchStats(selectedPageId)
    setBanner({ type: 'success', msg: `WhatsApp queued for ${lead.name ?? lead.phone ?? 'lead'}` })
  }

  const handleDisconnectAll = async () => {
    if (!confirm('Disconnect all Facebook pages? Lead syncing will stop.')) return
    await fetch('/api/facebook/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setPages([])
    setSelectedPageId(null)
    setActiveForms([])
    setLeads([])
    setPageStats({ total: 0, withPhone: 0, sent: 0, pending: 0 })
  }

  const handleRefresh = async () => {
    if (!selectedPageId || refreshing) return
    setRefreshing(true)
    setCurrentPage(1)
    await fetch(`/api/facebook/sync?page_id=${selectedPageId}`, { method: 'POST' })
    const leadsFormId = selectedFormId === '__forms' ? 'all' : selectedFormId
    await Promise.all([fetchActiveForms(selectedPageId), fetchLeads(leadsFormId, selectedPageId, 1, perPage, leadSearch), fetchStats(selectedPageId)])
    setRefreshing(false)
  }

  // ── Search debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPageId || selectedFormId === '__forms') return
    const t = setTimeout(() => {
      setCurrentPage(1)
      setLoadingLeads(true)
      fetchLeads(selectedFormId, selectedPageId, 1, perPage, leadSearch).finally(() => setLoadingLeads(false))
    }, 400)
    return () => clearTimeout(t)
  }, [leadSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pagination helper ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const goToPage = (page: number) => {
    if (!selectedPageId || page < 1 || page > totalPages) return
    setCurrentPage(page)
    setLoadingLeads(true)
    fetchLeads(selectedFormId, selectedPageId, page, perPage, leadSearch).finally(() => setLoadingLeads(false))
  }

  const pageNumbers = (() => {
    const pages: number[] = []
    const start = Math.max(1, currentPage - 2)
    const end   = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  })()

  // ── Render ────────────────────────────────────────────────────────────────

  // "Connect Facebook" empty state — only shown after we've confirmed pages is empty
  if (pagesLoaded && pages.length === 0) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        {banner && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full max-w-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {banner.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1">{banner.msg}</span>
            <button onClick={() => setBanner(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100 transition" /></button>
          </div>
        )}
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
          <Facebook className="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Facebook Lead Ads</h2>
          <p className="text-sm text-gray-400 max-w-sm">Connect your Facebook pages to receive leads and send automated WhatsApp messages.</p>
        </div>
        <a href="/api/facebook/auth"
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
          <Facebook className="w-4 h-4" /> Connect Facebook
        </a>
      </div>
    )
  }

  const { total: pageTotal, withPhone, sent, pending } = pageStats

  return (
    <div className="p-6 lg:p-8 space-y-5">

      {/* Banner */}
      {banner && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {banner.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100 transition" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Ads</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pages.length} page{pages.length !== 1 ? 's' : ''} connected
            {activeForms.length > 0 && ` · ${activeForms.length} form${activeForms.length !== 1 ? 's' : ''} active`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PageDropdown
            pages={pages}
            selectedId={selectedPageId}
            onSelect={handlePageChange}
            onDisconnectAll={handleDisconnectAll}
            onReconnect={() => { window.location.href = '/api/facebook/auth' }}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            title="Refresh leads"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh leads
          </button>
          <button
            onClick={handleDisconnectAll}
            className="p-2 text-red-400 border border-red-100 bg-white rounded-lg hover:bg-red-50 hover:text-red-600 transition"
            title="Disconnect all Facebook pages"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <a href="/api/facebook/auth"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Add page
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total leads', value: pageTotal, color: '#6b7280' },
          { label: 'With phone',  value: withPhone, color: '#3b82f6' },
          { label: 'WA sent',     value: sent,      color: '#10b981' },
          { label: 'Pending',     value: pending,   color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.value}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Automation setup callout — shown when no forms are activated */}
      {activeForms.length === 0 && !loadingForms && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">Set up WhatsApp automation</p>
            <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
              Go to <strong>All forms</strong> → click <strong>Activate</strong> next to your form → write your message template.
              Every new lead from that form will automatically get your WhatsApp message.
              For existing leads, use the <MessageCircle className="inline w-3 h-3 mx-0.5" /> button in each row.
            </p>
          </div>
          <button
            onClick={() => handleTabChange('__forms')}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition whitespace-nowrap"
          >
            All forms →
          </button>
        </div>
      )}

      {/* Main content card with tab bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-100 overflow-x-auto">
          {/* All leads */}
          <button
            onClick={() => handleTabChange('all')}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${selectedFormId === 'all' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            All leads
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${selectedFormId === 'all' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
              {total}
            </span>
          </button>

          {/* Per-form tabs */}
          {activeForms.map(form => {
            const c = getColor(form.color_index)
            const sel = selectedFormId === form.form_id
            return (
              <button key={form.form_id}
                onClick={() => handleTabChange(form.form_id)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${sel ? '' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                style={sel ? { borderBottomColor: c.dot, color: c.text } : {}}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                <span className="max-w-[140px] truncate">{form.form_name}</span>
                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={sel ? { background: c.bg, color: c.text } : { background: '#f9fafb', color: '#9ca3af' }}>
                  {form.lead_count}
                </span>
              </button>
            )
          })}

          {/* Hint when no forms activated */}
          {activeForms.length === 0 && !loadingForms && selectedFormId !== '__forms' && (
            <span className="flex-shrink-0 px-4 py-3.5 text-xs text-gray-300 whitespace-nowrap italic select-none">
              Activate forms to add tabs
            </span>
          )}

          {/* All forms tab — separated by a divider */}
          <div className="flex-shrink-0 border-l border-gray-100 flex items-stretch ml-auto">
            <button
              onClick={() => handleTabChange('__forms')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${selectedFormId === '__forms' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              All forms
            </button>
          </div>
        </div>

        {/* ── All forms view ── */}
        {selectedFormId === '__forms' ? (
          <div className="p-5">
            <AllFormsView
              pageId={selectedPageId}
              activeForms={activeForms}
              togglingId={togglingId}
              onActivate={form => { setPreActivateForm(form); setShowActivate(true) }}
              onEdit={form => setEditingForm(form)}
              onImport={form => setImportingForm(form)}
              onToggle={handleToggle}
            />
          </div>
        ) : (
          <>
            {/* Search + per-page toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/40">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="Search name, phone, email…"
                  className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                />
                {leadSearch && (
                  <button onClick={() => setLeadSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <select
                value={perPage}
                onChange={e => {
                  const v = Number(e.target.value) as 25 | 50 | 100
                  setPerPage(v)
                  setCurrentPage(1)
                  if (selectedPageId) {
                    setLoadingLeads(true)
                    fetchLeads(selectedFormId, selectedPageId, 1, v, leadSearch).finally(() => setLoadingLeads(false))
                  }
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none text-gray-500 cursor-pointer"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            {/* Table */}
            {loadingLeads ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                  {leadSearch ? <Search className="w-6 h-6 text-gray-200" /> : <Users className="w-6 h-6 text-gray-200" />}
                </div>
                <p className="text-sm text-gray-400">
                  {leadSearch ? `No leads matching "${leadSearch}"` : 'No leads yet'}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {leadSearch ? 'Try a different name, phone, or email' : 'Leads appear here as they come in from Facebook'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</th>
                      {selectedFormId === 'all' && (
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-48">Form</th>
                      )}
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leads.map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        activeForms={activeForms}
                        showFormBadge={selectedFormId === 'all'}
                        onWhatsApp={() => handleSendWhatsApp(lead)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {total > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                <p className="text-xs text-gray-400 tabular-nums">
                  {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, total).toLocaleString()} of {total.toLocaleString()} leads
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  {pageNumbers[0] > 1 && (
                    <>
                      <button onClick={() => goToPage(1)} className="min-w-[28px] h-7 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-500 transition">1</button>
                      {pageNumbers[0] > 2 && <span className="text-xs text-gray-300 px-1">…</span>}
                    </>
                  )}
                  {pageNumbers.map(n => (
                    <button key={n} onClick={() => goToPage(n)}
                      className={`min-w-[28px] h-7 text-xs font-medium rounded-lg transition ${n === currentPage ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
                      {n}
                    </button>
                  ))}
                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-xs text-gray-300 px-1">…</span>}
                      <button onClick={() => goToPage(totalPages)} className="min-w-[28px] h-7 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-500 transition">{totalPages}</button>
                    </>
                  )}
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showActivate && (
        <ActivateFormModal
          selectedPageId={selectedPageId}
          activeForms={activeForms}
          preSelectedForm={preActivateForm}
          onClose={() => { setShowActivate(false); setPreActivateForm(null) }}
          onActivate={handleActivate}
        />
      )}
      {editingForm && (
        <EditFormModal
          form={editingForm}
          onClose={() => setEditingForm(null)}
          onSave={handleEditSave}
        />
      )}
      {importingForm && (
        <ImportModal
          form={importingForm}
          onClose={() => setImportingForm(null)}
          onImport={(from, to) => handleImport(importingForm, from, to)}
        />
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  return (
    <Suspense fallback={<SyncingScreen />}>
      <LeadsContent />
    </Suspense>
  )
}

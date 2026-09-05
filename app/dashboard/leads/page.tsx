'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Facebook, RefreshCw, MessageCircle, Users, ChevronDown, ChevronUp,
  CheckCircle, X, Zap, Save, Plus, ChevronRight, ChevronLeft,
  Loader2, Pause, Play, Search, Edit2, Download, Clock,
  AlertCircle, FileText, LogOut, Sparkles, Send,
  Phone, Calendar, UserCheck,
} from 'lucide-react'
import type { StarterTemplate } from '@/lib/whatsapp-templates'
import { timeAgo } from '@/lib/utils'

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
  wa_template_name: string | null
  wa_template_language: string | null
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
  lead_status: string | null
  assigned_to: string | null
  assigned_name: string | null
  followup_at: string | null
  created_at: string
  fields: Record<string, string> | null
}

interface CallLog {
  id: string
  lead_id: string
  called_by: string
  caller_name: string | null
  outcome: string
  notes: string
  followup_at: string | null
  created_at: string
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
  onSave: (template: string, waTemplateName: string, waTemplateLang: string) => Promise<void>
}) {
  const [template,    setTemplate]    = useState(form.message_template || DEFAULT_TEMPLATE)
  const [waName,      setWaName]      = useState(form.wa_template_name ?? '')
  const [waLang,      setWaLang]      = useState(form.wa_template_language ?? 'en')
  const [saving,      setSaving]      = useState(false)
  const [starterTmpl, setStarterTmpl] = useState<(StarterTemplate & { status: string })[]>([])
  const [loadingTmpl, setLoadingTmpl] = useState(true)
  const c = getColor(form.color_index)

  useEffect(() => {
    fetch('/api/whatsapp/templates')
      .then(r => r.json())
      .then((d: { templates?: (StarterTemplate & { status: string })[] }) => setStarterTmpl(d.templates ?? []))
      .catch(() => setStarterTmpl([]))
      .finally(() => setLoadingTmpl(false))
  }, [])

  const handlePickStarter = (t: StarterTemplate & { status: string }) => {
    setTemplate(t.bodyPreview)
    setWaName(t.name)
    setWaLang(t.language)
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(template, waName.trim(), waLang.trim() || 'en'); onClose() }
    finally { setSaving(false) }
  }

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') return <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Approved</span>
    if (s === 'PENDING')  return <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Pending</span>
    if (s === 'REJECTED') return <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Rejected</span>
    return <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">Not submitted</span>
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: c.dot }} />
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-[400px]">{form.form_name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Wapaci Starter Templates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">Wapaci starter templates</span>
              <span className="text-xs text-gray-400">— pre-approved, click to use</span>
            </div>

            {loadingTmpl ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking approval status…
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {starterTmpl.map(t => (
                  <button
                    key={t.name}
                    onClick={() => handlePickStarter(t)}
                    className={`text-left px-3.5 py-3 rounded-xl border transition ${
                      waName === t.name
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500 font-mono">{t.name}</span>
                      {statusBadge(t.status)}
                    </div>
                    <p className="text-sm text-gray-700">{t.description}</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate">{t.bodyPreview}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message preview / custom editor */}
          <div className="border-t border-gray-100 pt-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Message preview
              {waName && <span className="ml-2 text-xs font-normal text-blue-600">using template &quot;{waName}&quot;</span>}
            </label>
            <textarea
              value={template}
              onChange={e => { setTemplate(e.target.value); setWaName(''); setWaLang('en') }}
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Variables: <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{phone}}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{email}}'}</code>{' '}
              — editing this text clears the template selection (use custom template below).
            </p>
          </div>

          {/* Custom template name override */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-0.5">
              Custom approved template name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              If you created your own template in{' '}
              <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Meta Business Manager</a>
              , enter the name here.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={waName}
                onChange={e => setWaName(e.target.value)}
                placeholder="e.g. my_custom_template"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={waLang}
                onChange={e => setWaLang(e.target.value)}
                placeholder="en"
                className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Language code (e.g. en, en_US, hi)"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || !template.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CalendarMonth ─────────────────────────────────────────────────────────────

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function CalendarMonth({ year, month, eFrom, eTo, today, onDay, onHover }: {
  year: number; month: number
  eFrom: string | null; eTo: string | null
  today: string
  onDay: (ds: string) => void
  onHover: (ds: string | null) => void
}) {
  const firstDow   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mm = String(month + 1).padStart(2, '0')

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800 text-center mb-3">
        {CAL_MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7">
        {CAL_DAYS.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-xs font-medium text-gray-400 select-none">{d}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d  = i + 1
          const ds = `${year}-${mm}-${String(d).padStart(2, '0')}`
          const isFuture = ds > today
          const isStart  = eFrom === ds
          const isEnd    = eTo   === ds
          const inRange  = !!(eFrom && eTo && ds > eFrom && ds < eTo)
          const isToday  = ds === today
          return (
            <div key={ds}
              onClick={() => !isFuture && onDay(ds)}
              onMouseEnter={() => !isFuture && onHover(ds)}
              onMouseLeave={() => onHover(null)}
              className={`h-7 flex items-center justify-center cursor-pointer
                ${isFuture ? 'opacity-25 cursor-not-allowed' : ''}
                ${inRange ? 'bg-blue-50' : ''}
              `}
            >
              <span className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors select-none
                ${isStart || isEnd ? 'bg-blue-600 text-white font-bold' :
                  inRange   ? 'text-blue-800' :
                  isToday   ? 'ring-1 ring-blue-400 text-gray-900 font-semibold' :
                  !isFuture ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}
              `}>
                {d}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DateRangePicker ───────────────────────────────────────────────────────────

function DateRangePicker({ from, to, onChange }: {
  from: string | null; to: string | null
  onChange: (from: string | null, to: string | null) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date()
  const [ry, setRy] = useState(now.getFullYear())
  const [rm, setRm] = useState(now.getMonth())
  const [hover, setHover] = useState<string | null>(null)
  const [phase, setPhase] = useState<'start' | 'end'>('start')

  const ly = rm === 0 ? ry - 1 : ry
  const lm = rm === 0 ? 11 : rm - 1

  // Effective range shown (includes hover preview during end-selection)
  let eFrom = from, eTo = to
  if (phase === 'end' && from && hover) {
    if (hover >= from) { eFrom = from;  eTo   = hover }
    else               { eFrom = hover; eTo   = from  }
  }

  const handleDay = (ds: string) => {
    if (phase === 'start' || !from) { onChange(ds, null); setPhase('end') }
    else {
      onChange(ds < from ? ds : from, ds < from ? from : ds)
      setPhase('start'); setHover(null)
    }
  }

  const navMonth = (dir: -1 | 1) => {
    let m = rm + dir, y = ry
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return
    setRm(m); setRy(y)
  }

  const preset = (days: number | 'all') => {
    const t = new Date()
    const ts = t.toISOString().split('T')[0]
    if (days === 'all') { onChange('2020-01-01', ts) }
    else { const f = new Date(t); f.setDate(f.getDate() - (days as number)); onChange(f.toISOString().split('T')[0], ts) }
    setPhase('start')
  }

  const fmt = (ds: string) => new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const canNext = ry < now.getFullYear() || (ry === now.getFullYear() && rm < now.getMonth())

  return (
    <div>
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {([['Last 7 days', 7], ['Last 30 days', 30], ['Last 3 months', 90], ['Last 6 months', 180], ['All time', 'all']] as [string, number | 'all'][]).map(([label, val]) => (
          <button key={label} onClick={() => preset(val)}
            className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition whitespace-nowrap">
            {label}
          </button>
        ))}
      </div>

      {/* Selected range display */}
      <div className="flex items-stretch gap-2 mb-4">
        <button onClick={() => setPhase('start')}
          className={`flex-1 px-3 py-2 rounded-xl border text-left transition ${phase === 'start' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <p className="text-xs text-gray-400 mb-0.5">Start date</p>
          <p className={`text-sm font-medium ${from ? 'text-gray-900' : 'text-gray-400'}`}>{from ? fmt(from) : 'Click a day'}</p>
        </button>
        <div className="flex items-center text-gray-300 text-lg px-1">→</div>
        <button onClick={() => from && setPhase('end')}
          className={`flex-1 px-3 py-2 rounded-xl border text-left transition ${phase === 'end' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <p className="text-xs text-gray-400 mb-0.5">End date</p>
          <p className={`text-sm font-medium ${to ? 'text-gray-900' : 'text-gray-400'}`}>{to ? fmt(to) : from ? 'Click end date' : '—'}</p>
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => navMonth(1)} disabled={!canNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two-month calendars */}
      <div className="grid grid-cols-2 gap-6">
        <CalendarMonth year={ly} month={lm} eFrom={eFrom} eTo={eTo} today={today} onDay={handleDay} onHover={setHover} />
        <CalendarMonth year={ry} month={rm} eFrom={eFrom} eTo={eTo} today={today} onDay={handleDay} onHover={setHover} />
      </div>
    </div>
  )
}

// ── ImportModal ───────────────────────────────────────────────────────────────

function ImportModal({ form, onClose, onImport }: {
  form: ActiveForm
  onClose: () => void
  onImport: (fromDate: string, toDate: string) => Promise<{ imported: number; total: number }>
}) {
  const [from, setFrom] = useState<string | null>(null)
  const [to,   setTo]   = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null)
  const c = getColor(form.color_index)

  const handleImport = async () => {
    if (!from || !to) return
    setImporting(true)
    try { setResult(await onImport(from, to)) }
    finally { setImporting(false) }
  }

  const handleDownloadCsv = async () => {
    if (!from || !to) return
    setExporting(true)
    setExportMsg(null)
    try {
      const params = new URLSearchParams({
        form_id:   form.form_id,
        from_date: from,
        to_date:   to,
        download:  'true',
        limit:     '5000',
      })
      const r = await fetch(`/api/facebook/leads?${params}`)
      const d = await r.json() as { leads?: Array<Record<string, unknown>>; total?: number }
      const leads = d.leads ?? []

      if (!leads.length) {
        setExportMsg('No leads found in your CRM for this date range.')
        return
      }

      const headers = ['Name', 'Email', 'Phone', 'Status', 'Date', 'Form']
      const rows = leads.map(l => [
        l.name ?? '', l.email ?? '', l.phone ?? '',
        l.wa_status, new Date(l.created_at as string).toLocaleDateString('en-US'),
        l.form_name ?? '',
      ])
      const csv = [headers, ...rows]
        .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${form.form_name.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_${from}_${to}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setExportMsg('Download failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.dot }} />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Import older leads</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[380px]">{form.form_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {result !== null ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              {result.total === 0 ? (
                <>
                  <p className="text-lg font-semibold text-gray-900 mb-1">No leads found</p>
                  <p className="text-sm text-gray-500">Facebook returned no leads for this date range.</p>
                </>
              ) : result.imported === 0 ? (
                <>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{result.total}</p>
                  <p className="text-sm text-gray-500">leads found — already in your CRM</p>
                  <p className="text-xs text-gray-400 mt-2">All leads from this period were already synced.</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{result.imported}</p>
                  <p className="text-sm text-gray-500">
                    new leads added
                    {result.total > result.imported && ` · ${result.total - result.imported} already existed`}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">These won&apos;t trigger WhatsApp messages.</p>
                </>
              )}
              <button onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition">
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-5">
                Select a date range to pull historical leads from Facebook. These won&apos;t trigger WhatsApp messages.
              </p>
              {exportMsg && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">{exportMsg}</p>
              )}
              <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setExportMsg(null) }} />
            </>
          )}
        </div>

        {/* Footer */}
        {result === null && (
          <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
            <button onClick={handleDownloadCsv} disabled={!from || !to || exporting || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition disabled:opacity-50">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting…' : 'Download CSV'}
            </button>
            <button onClick={handleImport} disabled={!from || !to || importing || exporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              {importing ? 'Importing…' : from && to ? 'Import to CRM' : 'Select a date range'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BulkMessageModal ──────────────────────────────────────────────────────────

function BulkMessageModal({ activeForms, onClose, onSent }: {
  activeForms: ActiveForm[]
  onClose: () => void
  onSent: (count: number) => void
}) {
  type WaTemplate = StarterTemplate & { status: string }

  const [step,             setStep]             = useState<'filters' | 'template'>('filters')
  const [selectedFormId,   setSelectedFormId]   = useState<string | null>(null)
  const [dateFrom,         setDateFrom]         = useState<string | null>(null)
  const [dateTo,           setDateTo]           = useState<string | null>(null)
  const [count,            setCount]            = useState<number | null>(null)
  const [loadingCount,     setLoadingCount]     = useState(false)
  const [templates,        setTemplates]        = useState<WaTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null)
  const [sending,          setSending]          = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Fetch count on mount and whenever filters change
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingCount(true)
      const p = new URLSearchParams()
      if (selectedFormId) p.set('form_id', selectedFormId)
      if (dateFrom) p.set('date_from', dateFrom)
      if (dateTo)   p.set('date_to', dateTo)
      try {
        const r = await fetch(`/api/leads/bulk-message?${p}`)
        const d = await r.json() as { count?: number }
        setCount(d.count ?? 0)
      } catch { setCount(null) }
      setLoadingCount(false)
    }, 500)
    return () => clearTimeout(t)
  }, [selectedFormId, dateFrom, dateTo])

  // Fetch approved templates when moving to template step
  useEffect(() => {
    if (step !== 'template') return
    setLoadingTemplates(true)
    fetch('/api/whatsapp/templates')
      .then(r => r.json())
      .then((d: { templates?: WaTemplate[] }) =>
        setTemplates((d.templates ?? []).filter(t => t.status === 'APPROVED'))
      )
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [step])

  const handleSend = async () => {
    if (!selectedTemplate) { setError('Choose a template first'); return }
    setSending(true); setError(null)
    try {
      const r = await fetch('/api/leads/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id:           selectedFormId,
          date_from:         dateFrom,
          date_to:           dateTo,
          template_name:     selectedTemplate.name,
          template_language: selectedTemplate.language,
          message:           selectedTemplate.bodyPreview,
        }),
      })
      const d = await r.json() as { queued?: number; error?: string }
      if (!r.ok) { setError(d.error ?? 'Failed'); return }
      onSent(d.queued ?? 0)
    } catch { setError('Network error') }
    finally { setSending(false) }
  }

  const selectedForm = activeForms.find(f => f.form_id === selectedFormId)
  const fmt = (ds: string) => new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Message existing leads</h2>
              <p className="text-xs text-gray-400 mt-0.5">Send a WhatsApp template to historical leads</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 bg-gray-50/60 flex-shrink-0">
          {(['filters', 'template'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition
                ${step === 'template' && s === 'filters'
                  ? 'bg-green-600 text-white'
                  : step === s ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {step === 'template' && s === 'filters' ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === s ? 'text-gray-800' : 'text-gray-400'}`}>
                {s === 'filters' ? 'Choose audience' : 'Pick template'}
              </span>
              {i === 0 && (
                <div className={`w-8 h-0.5 ${step === 'template' ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Step 1: Filters */}
          {step === 'filters' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lead form</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedFormId(null)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition
                      ${selectedFormId === null
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">All forms</span>
                  </button>
                  {activeForms.map(f => {
                    const c = getColor(f.color_index)
                    return (
                      <button
                        key={f.form_id}
                        onClick={() => setSelectedFormId(f.form_id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition
                          ${selectedFormId === f.form_id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                        <span className="font-medium text-gray-800 truncate" title={f.form_name}>{f.form_name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Date range <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <p className="text-xs text-gray-400 mb-3">Filter by when leads submitted the form</p>
                <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
              </div>

              {/* Count preview */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors
                ${count === null ? 'border-gray-200 bg-gray-50'
                  : count === 0 ? 'border-amber-200 bg-amber-50'
                  : 'border-green-200 bg-green-50'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${count === null ? 'bg-gray-100' : count === 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                  {loadingCount
                    ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    : <Users className={`w-5 h-5 ${count === 0 ? 'text-amber-600' : count !== null ? 'text-green-600' : 'text-gray-400'}`} />}
                </div>
                <div>
                  {loadingCount ? (
                    <p className="text-sm text-gray-400">Calculating…</p>
                  ) : count === null ? (
                    <p className="text-sm text-gray-500">Select filters to see lead count</p>
                  ) : count === 0 ? (
                    <>
                      <p className="text-sm font-semibold text-amber-800">No matching leads</p>
                      <p className="text-xs text-amber-600 mt-0.5">Try different filters, or check if leads are already marked &quot;Sent&quot;</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-green-800">{count.toLocaleString()} leads</p>
                      <p className="text-xs text-green-600">with a phone number, not yet messaged</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 'template' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">Choose a WhatsApp template</p>
                <p className="text-xs text-gray-400 mb-3">
                  Only Meta-approved templates can be sent to leads who haven&apos;t messaged you first.
                </p>

                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">No approved templates found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                      Make sure your WhatsApp is connected and your templates are approved by Meta.
                    </p>
                    <a href="/dashboard/templates"
                      className="inline-block mt-3 text-xs font-semibold text-blue-600 hover:underline">
                      Manage templates →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <button
                        key={t.name}
                        onClick={() => setSelectedTemplate(t)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition
                          ${selectedTemplate?.name === t.name
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-semibold text-gray-500">{t.name}</span>
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Approved</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 mb-1">{t.description}</p>
                        <p className="text-xs text-gray-500 italic">{t.bodyPreview}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">Audience</span>
                  <span className="font-semibold text-gray-800">
                    {selectedFormId ? (selectedForm?.form_name ?? selectedFormId) : 'All forms'}
                  </span>
                </div>
                {dateFrom && dateTo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date range</span>
                    <span className="font-semibold text-gray-800">{fmt(dateFrom)} — {fmt(dateTo)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipients</span>
                  <span className="font-bold text-green-700">{count?.toLocaleString() ?? '?'} leads</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 flex-shrink-0">
          {step === 'filters' ? (
            <>
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition">Cancel</button>
              <button
                onClick={() => { setError(null); setStep('template') }}
                disabled={!count || loadingCount}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
                Next: Choose template
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('filters')} className="text-sm text-gray-500 hover:text-gray-700 transition">
                ← Back
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedTemplate || sending}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending…' : `Send to ${count?.toLocaleString() ?? '?'} leads`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Call log constants ────────────────────────────────────────────────────────

const OUTCOME_META: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  connected: { label: 'Connected', dot: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  no_answer: { label: 'No Answer', dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  voicemail: { label: 'Voicemail', dot: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  callback:  { label: 'Callback',  dot: '#f97316', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  busy:      { label: 'Busy',      dot: '#6b7280', bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
}

const LEAD_STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  hot:       { label: 'Hot',       dot: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
  warm:      { label: 'Warm',      dot: '#f97316', bg: '#fff7ed', text: '#9a3412' },
  converted: { label: 'Converted', dot: '#10b981', bg: '#ecfdf5', text: '#065f46' },
  lost:      { label: 'Lost',      dot: '#6b7280', bg: '#f9fafb', text: '#374151' },
  junk:      { label: 'Junk',      dot: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
  resolved:  { label: 'Resolved',  dot: '#3b82f6', bg: '#eff6ff', text: '#1e40af' },
}

// ── CallLogModal ──────────────────────────────────────────────────────────────

function CallLogModal({ lead, onClose, onUpdate }: {
  lead: Lead
  onClose: () => void
  onUpdate: (leadId: string, updates: Partial<Lead>) => void
}) {
  const [logs, setLogs]           = useState<CallLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [outcome, setOutcome]     = useState<string | null>(null)
  const [notes, setNotes]         = useState('')
  const [followupAt, setFollowupAt] = useState('')
  const [tagStatus, setTagStatus] = useState<string | null>(lead.lead_status ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [tagging, setTagging]     = useState(false)
  const [localAssignedName, setLocalAssignedName] = useState(lead.assigned_name)

  useEffect(() => {
    fetch(`/api/leads/call-logs?lead_id=${lead.id}`)
      .then(r => r.json())
      .then((d: { logs: CallLog[] }) => { setLogs(d.logs ?? []); setLoadingLogs(false) })
      .catch(() => setLoadingLogs(false))
  }, [lead.id])

  const handleSubmit = async () => {
    if (!outcome) return
    setSubmitting(true)
    const body: Record<string, unknown> = { leadId: lead.id, outcome, notes }
    if (followupAt) body.followupAt = new Date(followupAt).toISOString()
    if (tagStatus !== lead.lead_status) body.tagStatus = tagStatus

    const r = await fetch('/api/leads/call-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json() as { log?: CallLog }
    if (d.log) setLogs(prev => [d.log!, ...prev])

    const updates: Partial<Lead> = {}
    if (followupAt) updates.followup_at = new Date(followupAt).toISOString()
    if (tagStatus !== lead.lead_status) updates.lead_status = tagStatus
    if (Object.keys(updates).length > 0) onUpdate(lead.id, updates)

    setOutcome(null); setNotes(''); setFollowupAt('')
    setSubmitting(false)
  }

  const handleAssign = async () => {
    setAssigning(true)
    const r = await fetch(`/api/leads/${lead.id}/assign`, { method: 'PATCH' })
    const d = await r.json() as { assigned_name?: string }
    if (d.assigned_name) {
      setLocalAssignedName(d.assigned_name)
      onUpdate(lead.id, { assigned_name: d.assigned_name })
    }
    setAssigning(false)
  }

  const handleTagChange = async (status: string | null) => {
    const next = tagStatus === status ? null : status
    setTagStatus(next)
    setTagging(true)
    await fetch('/api/facebook/leads/tag', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, status: next }),
    })
    onUpdate(lead.id, { lead_status: next })
    setTagging(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white h-full w-full max-w-md shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-base truncate">{lead.name ?? '—'}</p>
              {lead.phone ? (
                <a href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 mt-1 text-sm text-blue-600 hover:text-blue-800 transition w-fit">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{lead.phone}</span>
                  <span className="text-xs text-gray-400">tap to call</span>
                </a>
              ) : (
                <p className="text-sm text-gray-400 mt-1">No phone number</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition ml-3 flex-shrink-0">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Assignment row */}
          <div className="flex items-center justify-between">
            {localAssignedName ? (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                <UserCheck className="w-3 h-3" />
                {localAssignedName}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Unassigned</span>
            )}
            {!localAssignedName && (
              <button onClick={handleAssign} disabled={assigning}
                className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition disabled:opacity-60 flex items-center gap-1.5">
                {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                Take this lead
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Lead status tag */}
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Lead Status</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(LEAD_STATUS_META).map(([key, meta]) => (
                <button key={key}
                  onClick={() => !tagging && handleTagChange(key)}
                  disabled={tagging}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition"
                  style={tagStatus === key
                    ? { background: meta.dot, color: '#fff', borderColor: meta.dot }
                    : { background: meta.bg, color: meta.text, borderColor: '#e5e7eb' }
                  }>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: tagStatus === key ? '#fff' : meta.dot }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Log a call */}
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Log a Call</p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(OUTCOME_META).map(([key, meta]) => (
                <button key={key}
                  onClick={() => setOutcome(outcome === key ? null : key)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium border transition"
                  style={outcome === key
                    ? { background: meta.dot, color: '#fff', borderColor: meta.dot }
                    : { background: meta.bg, color: meta.text, borderColor: meta.border }
                  }>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: outcome === key ? '#fff' : meta.dot }} />
                  {meta.label}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this call…"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none mb-3"
            />

            <div className="flex items-start gap-2.5 mb-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Follow-up date (optional)</label>
                <input
                  type="date"
                  value={followupAt}
                  min={today}
                  onChange={e => setFollowupAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={!outcome || submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {submitting ? 'Saving…' : 'Save call log'}
            </button>
          </div>

          {/* Call history */}
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Call History</p>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No calls logged yet</p>
            ) : (
              <div className="space-y-4">
                {logs.map(log => {
                  const meta = OUTCOME_META[log.outcome]
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: meta?.dot ?? '#9ca3af' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold" style={{ color: meta?.text ?? '#374151' }}>
                            {meta?.label ?? log.outcome}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(log.created_at)}</span>
                        </div>
                        {log.caller_name && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{log.caller_name}</p>
                        )}
                        {log.notes && (
                          <p className="text-xs text-gray-700 mt-1 leading-relaxed">{log.notes}</p>
                        )}
                        {log.followup_at && (
                          <p className="text-[11px] text-orange-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow up {new Date(log.followup_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LeadRow ───────────────────────────────────────────────────────────────────

const STANDARD_KEYS = new Set([
  'name', 'email', 'phone', 'full_name', 'first_name', 'last_name', 'phone_number', 'mobile',
])

function LeadRow({ lead, activeForms, showFormBadge, onWhatsApp, onCallLog }: {
  lead: Lead
  activeForms: ActiveForm[]
  showFormBadge: boolean
  onWhatsApp: () => void
  onCallLog: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const form  = activeForms.find(f => f.form_id === lead.form_id)
  const color = form ? getColor(form.color_index) : null
  const extra = Object.entries(lead.fields ?? {}).filter(([k]) => !STANDARD_KEYS.has(k))

  const followupDate = lead.followup_at
    ? new Date(lead.followup_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const isOverdue = lead.followup_at ? new Date(lead.followup_at) < new Date() : false
  const leadStatusMeta = lead.lead_status ? LEAD_STATUS_META[lead.lead_status] : null

  return (
    <>
      <tr className="hover:bg-gray-50/40 transition-colors">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color.dot }} />}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-gray-900 truncate">{lead.name ?? '—'}</p>
                {leadStatusMeta && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: leadStatusMeta.bg, color: leadStatusMeta.text }}>
                    <span className="w-1 h-1 rounded-full" style={{ background: leadStatusMeta.dot }} />
                    {leadStatusMeta.label}
                  </span>
                )}
              </div>
              {lead.email && <p className="text-xs text-gray-400 truncate mt-0.5">{lead.email}</p>}
              {lead.assigned_name && (
                <p className="text-[11px] text-blue-500 mt-0.5 flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5" />
                  {lead.assigned_name}
                </p>
              )}
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
          {followupDate && (
            <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-orange-400'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {isOverdue ? 'Overdue: ' : ''}{followupDate}
            </p>
          )}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1">
            <button onClick={onCallLog}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-600 transition"
              title="Log a call / assign lead">
              <Phone className="w-4 h-4" />
            </button>
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
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownloadCsv = async (af: ActiveForm) => {
    setDownloading(af.form_id)
    try {
      const r = await fetch(`/api/facebook/leads?form_id=${af.form_id}&limit=1000`)
      const d = await r.json() as { leads?: Array<Record<string, unknown>> }
      const leads = d.leads ?? []
      if (!leads.length) return

      const headers = ['Name', 'Email', 'Phone', 'Status', 'Date', 'Form']
      const rows = leads.map(l => [
        l.name ?? '', l.email ?? '', l.phone ?? '',
        l.wa_status, new Date(l.created_at as string).toLocaleDateString('en-US'),
        l.form_name ?? '',
      ])
      const csv = [headers, ...rows]
        .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${af.form_name.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_leads.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

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
                    <button onClick={() => onImport(af)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 flex items-center gap-0.5" title="Download leads by date range">
                      <Download className="w-3.5 h-3.5" />
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onEdit(af)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600" title="Edit WhatsApp template">
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
  const [showBulkMsg,    setShowBulkMsg]    = useState(false)
  const [lockedPage,     setLockedPage]     = useState<{ page_id: string; page_name: string } | null>(null)
  const [showPageLockPopup, setShowPageLockPopup] = useState(false)
  const [callLogLead,    setCallLogLead]    = useState<Lead | null>(null)

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

      const [p, assocData] = await Promise.all([
        fetchPages(),
        fetch('/api/leads/whatsapp-association').then(r => r.json()),
        ...(cachedPageId ? [fetchActiveForms(cachedPageId), fetchLeads('all', cachedPageId), fetchStats(cachedPageId)] : []),
      ]) as [Page[], { locked_pages?: { page_id: string; page_name: string }[] }, ...unknown[]]
      const locked = (assocData?.locked_pages ?? [])[0] ?? null
      setLockedPage(locked)

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

  const handleEditSave = async (template: string, waTemplateName: string, waTemplateLang: string) => {
    if (!editingForm) return
    await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId:       editingForm.connection_id,
        formId:             editingForm.form_id,
        formName:           editingForm.form_name,
        messageTemplate:    template,
        isEnabled:          editingForm.is_enabled,
        waTemplateName:     waTemplateName || undefined,
        waTemplateLanguage: waTemplateLang || undefined,
      }),
    })
    if (selectedPageId) await fetchActiveForms(selectedPageId)
  }

  const handleImport = async (form: ActiveForm, fromDate: string, toDate: string) => {
    const r = await fetch('/api/facebook/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: form.connection_id, formId: form.form_id, fromDate, toDate }),
    })
    const d = await r.json() as { imported?: number; total?: number }
    if (selectedPageId) {
      await Promise.all([
        fetchActiveForms(selectedPageId),
        fetchStats(selectedPageId),
        ...(selectedFormId !== '__forms' ? [fetchLeads(selectedFormId, selectedPageId, 1, perPage, leadSearch)] : []),
      ])
    }
    return { imported: d.imported ?? 0, total: d.total ?? 0 }
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

  const handleLeadUpdate = (leadId: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l))
    setCallLogLead(prev => prev?.id === leadId ? { ...prev, ...updates } : prev)
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
    const r = await fetch(`/api/facebook/sync?page_id=${selectedPageId}`, { method: 'POST' })
    const d = await r.json() as { synced?: number; newLeads?: number; error?: string }
    const leadsFormId = selectedFormId === '__forms' ? 'all' : selectedFormId
    await Promise.all([fetchActiveForms(selectedPageId), fetchLeads(leadsFormId, selectedPageId, 1, perPage, leadSearch), fetchStats(selectedPageId)])
    setRefreshing(false)
    if (d.error) {
      setBanner({ type: 'error', msg: d.error })
    } else if (d.synced) {
      setBanner({ type: 'success', msg: `Synced ${d.synced} leads from Facebook` })
    } else {
      setBanner({ type: 'success', msg: 'Already up to date — no new leads found' })
    }
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
  // Only forms the user has explicitly enabled show as tabs
  const enabledForms = activeForms.filter(f => f.is_enabled)

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
            {activeForms.length > 0 && ` · ${activeForms.length} form${activeForms.length !== 1 ? 's' : ''} tracked`}
            {enabledForms.length > 0 && ` · ${enabledForms.length} with WhatsApp`}
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
            onClick={() => {
              if (lockedPage && selectedPageId && lockedPage.page_id !== selectedPageId) {
                setShowPageLockPopup(true)
              } else {
                setShowBulkMsg(true)
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1aad54] rounded-lg transition shadow-sm"
            title="Send a WhatsApp message to existing leads"
          >
            <MessageCircle className="w-4 h-4" />
            Message leads
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

      {/* Automation setup callout — shown when no forms have WhatsApp enabled */}
      {enabledForms.length === 0 && !loadingForms && (
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

          {/* Per-form tabs — only show forms the user has enabled WhatsApp for */}
          {enabledForms.map(form => {
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

          {/* Hint when no forms have WhatsApp enabled */}
          {enabledForms.length === 0 && !loadingForms && selectedFormId !== '__forms' && (
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
                        onCallLog={() => setCallLogLead(lead)}
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
      {showBulkMsg && (
        <BulkMessageModal
          activeForms={activeForms}
          onClose={() => setShowBulkMsg(false)}
          onSent={count => {
            setShowBulkMsg(false)
            setBanner({ type: 'success', msg: `${count.toLocaleString()} leads queued for WhatsApp messages` })
            if (selectedPageId) {
              fetchStats(selectedPageId)
              if (selectedFormId !== '__forms') fetchLeads(selectedFormId, selectedPageId, currentPage, perPage, leadSearch)
            }
          }}
        />
      )}

      {/* Call log modal */}
      {callLogLead && (
        <CallLogModal
          lead={callLogLead}
          onClose={() => setCallLogLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}

      {/* Page lock popup — shown when user tries to message leads from a different page */}
      {showPageLockPopup && lockedPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              WhatsApp already linked to another page
            </h3>
            <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">
              Your WhatsApp is already connected to <span className="font-semibold text-slate-700">{lockedPage.page_name}</span>. Each Wapaci account can only message leads from one Facebook page. To manage a different page, create a separate Wapaci account.
            </p>
            <button
              onClick={() => setShowPageLockPopup(false)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">
              Got it
            </button>
          </div>
        </div>
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

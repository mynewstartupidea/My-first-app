'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Facebook, RefreshCw, MessageCircle, Users, ChevronDown,
  CheckCircle, XCircle, Clock, Phone, Mail, FileText,
  Zap, X, Save, Settings, Plus, ChevronUp
} from 'lucide-react'

interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  form_id: string | null
  form_name: string | null
  page_id: string | null
  wa_status: 'pending' | 'sent' | 'failed' | 'no_phone'
  created_at: string
  fields: Record<string, string> | null
}

interface FormAutomation {
  form_id: string
  message_template: string
  is_enabled: boolean
}

interface LeadForm {
  id: string
  name: string
  status: string
  automation: FormAutomation | null
}

interface Page {
  id: string
  page_id: string
  page_name: string
  subscribed_to_leadgen: boolean
  forms: LeadForm[]
}

const DEFAULT_TEMPLATE = "Hi {{name}}! 👋 Thanks for your interest. We'll reach out to you shortly via WhatsApp!"

function StatusBadge({ status }: { status: Lead['wa_status'] }) {
  const map = {
    sent:     { icon: CheckCircle, label: 'Sent',     cls: 'text-green-700 bg-green-50 border-green-200' },
    pending:  { icon: Clock,       label: 'Pending',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    failed:   { icon: XCircle,     label: 'Failed',   cls: 'text-red-700 bg-red-50 border-red-200'       },
    no_phone: { icon: Phone,       label: 'No phone', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  }
  const { icon: Icon, label, cls } = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function PageDropdown({ pages, selected, onSelect, onDisconnect, onDisconnectAll }: {
  pages: Page[]
  selected: Page | null
  onSelect: (page: Page) => void
  onDisconnect: (pageId: string) => void
  onDisconnectAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition min-w-[240px]"
      >
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
          <Facebook className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-medium text-slate-800 flex-1 text-left truncate">
          {selected ? selected.page_name : 'Select a page'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[280px]">
          {/* Pages list */}
          <div className="max-h-56 overflow-y-auto">
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Your pages</p>
            {pages.map(page => (
              <button
                key={page.page_id}
                onClick={() => { onSelect(page); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 transition ${selected?.page_id === page.page_id ? 'bg-blue-50' : ''}`}
              >
                <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
                  <Facebook className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{page.page_name}</p>
                  <p className="text-xs text-slate-400">{page.forms.length} form{page.forms.length !== 1 ? 's' : ''}</p>
                </div>
                {selected?.page_id === page.page_id && (
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="border-t border-slate-100 p-2 space-y-0.5">
            <a
              href="/api/facebook/auth"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition w-full"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Reconnect Facebook
            </a>
            {selected && (
              <button
                onClick={() => { setOpen(false); onDisconnect(selected.page_id) }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition w-full"
              >
                <X className="w-3.5 h-3.5" />
                Disconnect "{selected.page_name}"
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onDisconnectAll() }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition w-full font-medium"
            >
              <XCircle className="w-3.5 h-3.5" />
              Disconnect all pages
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FormAutomationsPanel({ page, leads, onSave }: {
  page: Page
  leads: Lead[]
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editForm, setEditForm] = useState<string | null>(null)

  if (page.forms.length === 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
      <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">No lead forms found on this page</p>
        <p className="text-xs text-amber-700 mt-0.5">
          This could mean: the forms are on a different page, or the token needs a refresh.{' '}
          <a href="/api/facebook/auth" className="underline font-medium">Reconnect Facebook</a>{' '}
          to get fresh access, or check{' '}
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer" className="underline font-medium">
            Meta Ads Manager
          </a>{' '}
          to verify which page your forms are under.
        </p>
      </div>
    </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Form automations</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {page.forms.length} form{page.forms.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {page.forms.map(form => {
            const formLeads = leads.filter(l => l.form_id === form.id)
            const fieldKeys = Array.from(new Set(formLeads.flatMap(l => Object.keys(l.fields ?? {}))))
            const isEditing = editForm === form.id

            return (
              <div key={form.id} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <p className="text-sm font-medium text-slate-700 truncate">{form.name}</p>
                    {form.automation?.is_enabled && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Auto ON
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditForm(isEditing ? null : form.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-3 flex-shrink-0"
                  >
                    {isEditing ? 'Close' : 'Configure'}
                  </button>
                </div>

                {isEditing && (
                  <AutomationEditor
                    pageId={page.id}
                    form={form}
                    formFieldKeys={fieldKeys}
                    onSave={onSave}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AutomationEditor({ pageId, form, formFieldKeys, onSave }: {
  pageId: string
  form: LeadForm
  formFieldKeys: string[]
  onSave: () => void
}) {
  const [msg, setMsg]         = useState(form.automation?.message_template ?? DEFAULT_TEMPLATE)
  const [enabled, setEnabled] = useState(form.automation?.is_enabled ?? true)
  const [saving, setSaving]   = useState(false)

  const allVars = Array.from(new Set(['name', 'email', 'phone', ...formFieldKeys]))

  async function save() {
    setSaving(true)
    await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId:    pageId,
        formId:          form.id,
        formName:        form.name,
        messageTemplate: msg,
        isEnabled:       enabled,
      }),
    })
    setSaving(false)
    onSave()
  }

  return (
    <div className="mt-3 space-y-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">WhatsApp auto-reply</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">{enabled ? 'Enabled' : 'Disabled'}</span>
          <div
            onClick={() => setEnabled(e => !e)}
            className={`w-9 h-5 rounded-full transition relative ${enabled ? 'bg-[#25D366]' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
          </div>
        </label>
      </div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        rows={3}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 resize-none bg-white"
        placeholder="Message to send when a new lead arrives..."
      />
      <div>
        <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wide font-medium">Click to insert variable</p>
        <div className="flex flex-wrap gap-1.5">
          {allVars.map(key => (
            <button
              key={key}
              onClick={() => setMsg(prev => prev + `{{${key}}}`)}
              className="text-[11px] font-mono bg-white hover:bg-[#25D366]/10 hover:text-[#25D366] text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition"
            >
              {`{{${key}}}`}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 text-xs font-semibold bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-1.5 rounded-lg transition disabled:opacity-60"
      >
        <Save className="w-3 h-3" />
        {saving ? 'Saving…' : 'Save automation'}
      </button>
    </div>
  )
}

function LeadsContent() {
  const searchParams = useSearchParams()
  const fbStatus     = searchParams.get('fb')

  const [leads, setLeads]         = useState<Lead[]>([])
  const [pages, setPages]         = useState<Page[]>([])
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [banner, setBanner]       = useState('')
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  useEffect(() => {
    if (fbStatus === 'connected') setBanner('Facebook page connected! Syncing your leads…')
    if (fbStatus === 'denied')    setBanner('Facebook connection was cancelled.')
    if (fbStatus === 'no_pages')  setBanner('No Facebook Pages found on your account.')
    if (fbStatus === 'error')     setBanner('Facebook connection failed. Please try again.')
  }, [fbStatus])

  const fetchData = useCallback(async (sync = false) => {
    if (sync) setSyncing(true)
    else setLoading(true)
    try {
      const [leadsRes, pagesRes] = await Promise.all([
        fetch(`/api/facebook/leads${sync ? '?sync=1' : ''}`),
        fetch('/api/facebook/pages'),
      ])
      const [leadsData, pagesData] = await Promise.all([leadsRes.json(), pagesRes.json()])
      const newPages = pagesData.pages ?? []
      setLeads(leadsData.leads ?? [])
      setPages(newPages)
      setSelectedPage(prev => {
        if (prev) return newPages.find((p: Page) => p.page_id === prev.page_id) ?? newPages[0] ?? null
        return newPages[0] ?? null
      })
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(fbStatus === 'connected')
  }, [fetchData, fbStatus])

  async function disconnectPage(pageId: string) {
    if (!confirm('Disconnect this page? Leads already captured will remain.')) return
    await fetch('/api/facebook/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId }),
    })
    fetchData()
  }

  async function disconnectAll() {
    if (!confirm('Disconnect all Facebook pages? Leads already captured will remain.')) return
    await fetch('/api/facebook/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setSelectedPage(null)
    fetchData()
  }

  const connected = pages.length > 0
  const filteredLeads = selectedPage
    ? leads.filter(l => l.page_id === selectedPage.page_id)
    : leads

  const stats = {
    total:   filteredLeads.length,
    sent:    filteredLeads.filter(l => l.wa_status === 'sent').length,
    pending: filteredLeads.filter(l => l.wa_status === 'pending').length,
    noPhone: filteredLeads.filter(l => l.wa_status === 'no_phone').length,
  }

  if (!connected && !loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center max-w-md w-full">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Facebook className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Connect your Facebook Page</h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
          Connect a Facebook Page to automatically capture leads from your Lead Ad forms and send them a WhatsApp message instantly.
        </p>
        <a
          href="/api/facebook/auth"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
        >
          <Facebook className="w-5 h-5" />
          Connect Facebook Page
        </a>
        <div className="mt-8 flex items-center justify-center gap-6 text-center">
          {[
            { icon: Facebook,      label: 'Lead Ad fires'      },
            { icon: Zap,           label: 'Wapaci captures it' },
            { icon: MessageCircle, label: 'WhatsApp sent'      },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i}>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                <Icon className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
            <p className="text-slate-500 text-sm mt-0.5">Facebook Lead Ads → automatic WhatsApp follow-up</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-3 py-2.5 rounded-xl transition disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync leads'}
            </button>
            <a
              href="/api/facebook/auth"
              className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Add page
            </a>
          </div>
        </div>

        {/* Banner */}
        {banner && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-xl">
            <span>{banner}</span>
            <button onClick={() => setBanner('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-slate-200 rounded-xl w-64" />
            <div className="grid grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
            </div>
            <div className="h-64 bg-slate-200 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Page selector row */}
            <div className="flex items-center gap-3">
              <PageDropdown
                pages={pages}
                selected={selectedPage}
                onSelect={setSelectedPage}
                onDisconnect={disconnectPage}
                onDisconnectAll={disconnectAll}
              />
              <span className="text-xs text-slate-400">{pages.length} page{pages.length !== 1 ? 's' : ''} connected</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total leads',     value: stats.total,   icon: Users,       cls: 'text-slate-600' },
                { label: 'WhatsApp sent',   value: stats.sent,    icon: CheckCircle, cls: 'text-green-600' },
                { label: 'Pending',         value: stats.pending, icon: Clock,       cls: 'text-amber-600' },
                { label: 'No phone number', value: stats.noPhone, icon: Phone,       cls: 'text-slate-400' },
              ].map(({ label, value, icon: Icon, cls }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-100 px-4 py-4">
                  <div className={`flex items-center gap-1.5 ${cls} mb-1`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Form automations for selected page */}
            {selectedPage && (
              <FormAutomationsPanel
                page={selectedPage}
                leads={filteredLeads}
                onSave={() => fetchData()}
              />
            )}

            {/* Leads table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  {selectedPage ? `${selectedPage.page_name} leads` : 'All leads'}
                </h2>
                <span className="text-xs text-slate-400">{filteredLeads.length} total</span>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No leads yet for this page.</p>
                  <button
                    onClick={() => fetchData(true)}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Sync from Facebook
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Contact</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Form</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredLeads.map(lead => {
                        const isExpanded = expandedLead === lead.id
                        const extraFields = Object.entries(lead.fields ?? {}).filter(
                          ([k]) => !['full_name','first_name','last_name','email','phone_number','phone'].includes(k)
                        )
                        return (
                          <>
                            <tr
                              key={lead.id}
                              onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                              className="hover:bg-slate-50 transition cursor-pointer"
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  {extraFields.length > 0 && (
                                    isExpanded
                                      ? <ChevronUp className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      : <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  )}
                                  <p className="font-medium text-slate-800">
                                    {lead.name ?? <span className="text-slate-400 italic text-xs">Unknown</span>}
                                  </p>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 space-y-0.5">
                                {lead.phone && (
                                  <div className="flex items-center gap-1 text-slate-600 text-xs">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {lead.phone}
                                  </div>
                                )}
                                {lead.email && (
                                  <div className="flex items-center gap-1 text-slate-600 text-xs">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {lead.email}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-xs text-slate-500">{lead.form_name ?? '—'}</span>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                {new Date(lead.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </td>
                              <td className="px-5 py-3.5">
                                <StatusBadge status={lead.wa_status} />
                              </td>
                            </tr>
                            {isExpanded && extraFields.length > 0 && (
                              <tr key={`${lead.id}-exp`} className="bg-blue-50/30">
                                <td colSpan={5} className="px-8 py-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                                    {extraFields.map(([key, val]) => (
                                      <div key={key}>
                                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">
                                          {key.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-sm font-medium text-slate-700">{val}</p>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading…</div>}>
      <LeadsContent />
    </Suspense>
  )
}

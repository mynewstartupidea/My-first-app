'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Facebook, RefreshCw, MessageCircle, Users, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, Phone, Mail, FileText, Zap, X, Save
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
  connection_id?: string
  forms: LeadForm[]
}

const DEFAULT_TEMPLATE = 'Hi {{name}}! 👋 Thanks for your interest. We\'ll reach out to you shortly via WhatsApp!'

function StatusBadge({ status }: { status: Lead['wa_status'] }) {
  const map = {
    sent:     { icon: CheckCircle, label: 'Sent',     cls: 'text-green-600 bg-green-50' },
    pending:  { icon: Clock,       label: 'Pending',  cls: 'text-amber-600 bg-amber-50' },
    failed:   { icon: XCircle,     label: 'Failed',   cls: 'text-red-600 bg-red-50'     },
    no_phone: { icon: Phone,       label: 'No phone', cls: 'text-slate-500 bg-slate-100' },
  }
  const { icon: Icon, label, cls } = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function AutomationEditor({ page, form, onSave, formFieldKeys }: {
  page: Page
  form: LeadForm
  onSave: () => void
  formFieldKeys: string[]
}) {
  const [msg, setMsg]         = useState(form.automation?.message_template ?? DEFAULT_TEMPLATE)
  const [enabled, setEnabled] = useState(form.automation?.is_enabled ?? true)
  const [saving, setSaving]   = useState(false)

  const allVars = Array.from(new Set([
    'name', 'email', 'phone', ...formFieldKeys,
  ]))

  function insertVar(key: string) {
    setMsg(prev => prev + `{{${key}}}`)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/facebook/form-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId:    page.id,
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
    <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">WhatsApp auto-reply</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">Enabled</span>
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
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 resize-none"
        placeholder="Message to send when a new lead arrives..."
      />
      <div>
        <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wide font-medium">Click to insert variable</p>
        <div className="flex flex-wrap gap-1.5">
          {allVars.map(key => (
            <button
              key={key}
              onClick={() => insertVar(key)}
              className="text-[11px] font-mono bg-slate-100 hover:bg-[#25D366]/10 hover:text-[#25D366] text-slate-600 px-2 py-0.5 rounded transition border border-slate-200"
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

function PageCard({ page, onDisconnect, onRefresh, leadsByForm }: {
  page: Page
  onDisconnect: (pageId: string) => void
  onRefresh: () => void
  leadsByForm: Record<string, Lead[]>
}) {
  const [open, setOpen] = useState(false)
  const [editForm, setEditForm] = useState<string | null>(null)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Facebook className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{page.page_name}</p>
            <p className="text-xs text-slate-400">
              {page.forms.length} form{page.forms.length !== 1 ? 's' : ''} · {' '}
              {page.subscribed_to_leadgen
                ? <span className="text-green-600">Real-time leads active</span>
                : <span className="text-amber-600">Polling every 5 min</span>
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onDisconnect(page.page_id) }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition"
          >
            Disconnect
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {page.forms.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No lead forms found on this page.</p>
          )}
          {page.forms.map(form => {
            const formLeads = leadsByForm[form.id] ?? []
            const fieldKeys = Array.from(
              new Set(formLeads.flatMap(l => Object.keys(l.fields ?? {})))
            )
            return (
              <div key={form.id} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">{form.name}</p>
                    {form.automation?.is_enabled && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Auto-reply ON</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditForm(editForm === form.id ? null : form.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {editForm === form.id ? 'Close' : 'Configure'}
                  </button>
                </div>
                {editForm === form.id && (
                  <AutomationEditor page={page} form={form} onSave={onRefresh} formFieldKeys={fieldKeys} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LeadsContent() {
  const searchParams = useSearchParams()
  const fbStatus     = searchParams.get('fb')

  const [leads, setLeads]       = useState<Lead[]>([])
  const [pages, setPages]       = useState<Page[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [banner, setBanner]     = useState('')
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
      setLeads(leadsData.leads ?? [])
      setPages(pagesData.pages ?? [])
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

  const connected = pages.length > 0

  const leadsByForm = leads.reduce<Record<string, Lead[]>>((acc, l) => {
    if (l.form_id) {
      acc[l.form_id] = acc[l.form_id] ?? []
      acc[l.form_id].push(l)
    }
    return acc
  }, {})

  const stats = {
    total:   leads.length,
    sent:    leads.filter(l => l.wa_status === 'sent').length,
    pending: leads.filter(l => l.wa_status === 'pending').length,
    noPhone: leads.filter(l => l.wa_status === 'no_phone').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
            <p className="text-slate-500 text-sm mt-1">Facebook Lead Ads → automatic WhatsApp follow-up</p>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <button
                onClick={() => fetchData(true)}
                disabled={syncing}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-3 py-2 rounded-lg transition disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync leads'}
              </button>
            )}
            <a
              href="/api/facebook/auth"
              className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Facebook className="w-4 h-4" />
              {connected ? 'Add another page' : 'Connect Facebook'}
            </a>
          </div>
        </div>

        {/* Banner */}
        {banner && (
          <div className="mb-5 flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-xl">
            <span>{banner}</span>
            <button onClick={() => setBanner('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Stats */}
        {connected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total leads',        value: stats.total,   icon: Users,          cls: 'text-slate-700' },
              { label: 'WhatsApp sent',      value: stats.sent,    icon: CheckCircle,    cls: 'text-green-600' },
              { label: 'Pending',            value: stats.pending, icon: Clock,          cls: 'text-amber-600' },
              { label: 'No phone number',    value: stats.noPhone, icon: Phone,          cls: 'text-slate-400' },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className={`flex items-center gap-1.5 ${cls} mb-1`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {!connected && !loading ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
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
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
              {[
                { icon: Facebook,       label: 'Lead Ad fires'       },
                { icon: Zap,            label: 'Wapaci captures it'  },
                { icon: MessageCircle,  label: 'WhatsApp sent'       },
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Connected pages + form automations */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Connected Pages</h2>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl" />)}
                </div>
              ) : pages.map(page => (
                <PageCard
                  key={page.page_id}
                  page={page}
                  onDisconnect={disconnectPage}
                  onRefresh={() => fetchData()}
                  leadsByForm={leadsByForm}
                />
              ))}
            </div>

            {/* Leads table */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Leads</h2>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
                ) : leads.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No leads yet. They'll appear here as soon as someone fills your Lead Ad form.</p>
                    <button
                      onClick={() => fetchData(true)}
                      className="mt-4 text-sm text-blue-600 hover:underline"
                    >
                      Sync from Facebook
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Contact</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Form</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">WhatsApp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {leads.map(lead => {
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
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    {isExpanded
                                      ? <ChevronUp className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      : <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                                    <p className="font-medium text-slate-800">{lead.name ?? <span className="text-slate-400 italic">Unknown</span>}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 space-y-0.5">
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
                                <td className="px-4 py-3">
                                  <span className="text-xs text-slate-500">{lead.form_name ?? '—'}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                  {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={lead.wa_status} />
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${lead.id}-details`} className="bg-blue-50/40">
                                  <td colSpan={5} className="px-6 py-4">
                                    {extraFields.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic">No additional question answers for this lead.</p>
                                    ) : (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                                        {extraFields.map(([key, val]) => (
                                          <div key={key}>
                                            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                                              {key.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-xs font-medium text-slate-700">{val}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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
            </div>

          </div>
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

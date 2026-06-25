'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Users, Search, Filter, Download, Tag, Upload,
  Loader2, ShoppingBag, Phone, TrendingUp, Check,
  Star, RefreshCw, MoreVertical, X, FileText,
  MessageCircle, Plus, AlertCircle, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface Customer {
  id: string
  phone: string
  name: string | null
  email: string | null
  total_orders: number
  total_spent: number
  last_order_at: string | null
  whatsapp_opt_in: boolean
  created_at: string
}

interface UploadResult {
  found: number
  valid: number
  whatsapp: number
  saved: number
  skipped: number
  whatsapp_checked: boolean
}

const SEGMENTS = [
  { id: 'all',       label: 'All Contacts',   filter: (_c: Customer) => true },
  { id: 'opted_in',  label: 'WhatsApp Opt-in', filter: (c: Customer) => c.whatsapp_opt_in },
  { id: 'vip',       label: 'VIP (₹5k+)',      filter: (c: Customer) => c.total_spent >= 5000 },
  { id: 'repeat',    label: 'Repeat Buyers',   filter: (c: Customer) => c.total_orders >= 2 },
  { id: 'inactive',  label: 'Inactive 30d',    filter: (c: Customer) => {
    if (!c.last_order_at) return true
    return Date.now() - new Date(c.last_order_at).getTime() > 30 * 86400000
  }},
  { id: 'new',       label: 'First-time',      filter: (c: Customer) => c.total_orders <= 1 },
]

function avatarColor(phone: string) {
  const colors = ['bg-violet-100 text-violet-600','bg-blue-100 text-blue-600',
    'bg-emerald-100 text-emerald-600','bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600','bg-cyan-100 text-cyan-600']
  return colors[phone.charCodeAt(phone.length - 1) % colors.length]
}

// ─── Upload Modal ──────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'reading' | 'uploading' | 'done' | 'error'

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError]   = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!['csv', 'txt', 'vcf'].includes(ext)) {
      setError('Unsupported file type. Please upload a CSV, TXT, or VCF file.')
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
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
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

        {/* Header */}
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

          {/* IDLE — drop zone */}
          {state === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition',
                  dragOver
                    ? 'border-[#25D366] bg-[#25D366]/5'
                    : 'border-slate-200 hover:border-[#25D366]/50 hover:bg-slate-50/70'
                )}>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Drag & drop your file here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-3 bg-slate-100 rounded-lg px-3 py-1.5 inline-block">
                  CSV · TXT · VCF supported
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.vcf"
                className="hidden"
                onChange={onFileChange}
              />
              <p className="text-[11px] text-slate-400 text-center mt-3">
                We&apos;ll automatically find all Indian mobile numbers and check which ones have WhatsApp.
              </p>
            </>
          )}

          {/* READING */}
          {state === 'reading' && (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-[#25D366] mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Reading file…</p>
            </div>
          )}

          {/* UPLOADING */}
          {state === 'uploading' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-3">
                <MessageCircle size={24} className="text-[#25D366] animate-pulse" />
              </div>
              <p className="text-sm font-medium text-slate-700">Checking WhatsApp numbers…</p>
              <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* DONE */}
          {state === 'done' && result && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 size={20} className="text-[#25D366]" />
                <p className="font-semibold text-slate-800">Upload complete!</p>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50">
                  <span className="text-xs text-slate-500">Phone numbers found in file</span>
                  <span className="text-sm font-bold text-slate-800">{result.found.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-50">
                  <span className="text-xs text-blue-700">Valid Indian mobile numbers</span>
                  <span className="text-sm font-bold text-blue-700">{result.valid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-[#25D366]/10">
                  <span className="text-xs text-[#128C7E] font-medium">
                    Have WhatsApp
                    {!result.whatsapp_checked && <span className="ml-1 text-[10px] opacity-70">(estimated)</span>}
                  </span>
                  <span className="text-sm font-bold text-[#128C7E]">{result.whatsapp.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-emerald-50">
                  <span className="text-xs text-emerald-700">New contacts saved</span>
                  <span className="text-sm font-bold text-emerald-700">{result.saved.toLocaleString()}</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50">
                    <span className="text-xs text-slate-500">Already in contacts (skipped)</span>
                    <span className="text-sm font-bold text-slate-500">{result.skipped.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={reset}
                  className="flex-1 text-sm font-medium border border-slate-200 text-slate-600 py-2 rounded-xl hover:bg-slate-50 transition">
                  Upload Another
                </button>
                <button onClick={onSuccess}
                  className="flex-1 text-sm font-medium bg-[#25D366] text-white py-2 rounded-xl hover:bg-[#1aad54] transition">
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div>
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 mb-5">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <button onClick={reset}
                className="w-full text-sm font-medium border border-slate-200 text-slate-600 py-2 rounded-xl hover:bg-slate-50 transition">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [segment, setSegment]     = useState('all')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contacts')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json() as { contacts: Customer[] }
      setCustomers(data.contacts ?? [])
    } catch {
      // network error — keep existing list
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const seg = SEGMENTS.find(s => s.id === segment) ?? SEGMENTS[0]
  const displayed = customers.filter(c => {
    if (!seg.filter(c)) return false
    if (!search) return true
    const s = search.toLowerCase()
    return c.phone.includes(s) || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
  })

  const stats = useMemo(() => ({
    total:   customers.length,
    optIn:   customers.filter(c => c.whatsapp_opt_in).length,
    vip:     customers.filter(c => c.total_spent >= 5000).length,
    revenue: customers.reduce((s, c) => s + c.total_spent, 0),
  }), [customers])

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function exportCSV() {
    const rows = [['Name','Phone','Email','Orders','Spent','WhatsApp']]
    displayed.forEach(c => rows.push([c.name??'',c.phone,c.email??'',
      String(c.total_orders),String(c.total_spent),c.whatsapp_opt_in?'Yes':'No']))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'wapaci-contacts.csv'; a.click()
  }

  function sendBulkCampaign() {
    if (selected.size === 0) return
    // Placeholder: navigate to campaign creator with selected phones pre-filled
    const phones = customers
      .filter(c => selected.has(c.id))
      .map(c => c.phone)
      .join(',')
    window.location.href = `/dashboard/campaigns/new?phones=${encodeURIComponent(phones)}`
  }

  return (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); load() }}
        />
      )}

      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-500 text-sm mt-0.5">{stats.total.toLocaleString()} contacts · {stats.optIn.toLocaleString()} WhatsApp opt-in</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition">
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-[#25D366] text-white px-3 py-2 rounded-xl hover:bg-[#1aad54] transition">
              <Upload size={14} /> Upload Contacts
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Contacts',  value: stats.total.toLocaleString(),    icon: Users,       cls: 'text-blue-600 bg-blue-50' },
            { label: 'WhatsApp Opt-in', value: stats.optIn.toLocaleString(),    icon: Check,       cls: 'text-emerald-600 bg-emerald-50' },
            { label: 'VIP Customers',   value: stats.vip.toLocaleString(),      icon: Star,        cls: 'text-amber-600 bg-amber-50' },
            { label: 'Total Revenue',   value: formatCurrency(stats.revenue),   icon: TrendingUp,  cls: 'text-purple-600 bg-purple-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-xs font-medium">{s.label}</p>
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', s.cls.split(' ')[1])}>
                  <s.icon size={13} className={s.cls.split(' ')[0]} />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          {/* Segment tabs */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 overflow-x-auto">
            <Filter size={13} className="text-slate-400 flex-shrink-0" />
            {SEGMENTS.map(s => (
              <button key={s.id} onClick={() => setSegment(s.id)}
                className={cn('flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition whitespace-nowrap',
                  segment === s.id ? 'bg-[#25D366] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {s.label}
                <span className={cn('ml-1.5', segment === s.id ? 'opacity-70' : 'text-slate-400')}>
                  {customers.filter(s.filter).length}
                </span>
              </button>
            ))}
          </div>

          {/* Search + bulk actions */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 bg-white" />
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">{selected.size} selected</span>
                <button className="flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 transition cursor-default opacity-60" title="Tag feature coming soon">
                  <Tag size={11} /> Tag
                </button>
                <button
                  onClick={sendBulkCampaign}
                  className="flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition">
                  <MessageCircle size={11} /> Campaign
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-[#25D366]" /></div>
          ) : displayed.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Users size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-700 font-medium text-sm">
                {customers.length === 0 ? 'No contacts yet' : 'No contacts match this filter'}
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                {customers.length === 0
                  ? 'Upload a CSV or VCF file to import your customer contacts.'
                  : 'Try selecting a different segment or clearing your search.'}
              </p>
              {customers.length === 0 && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium bg-[#25D366] text-white px-4 py-2 rounded-xl hover:bg-[#1aad54] transition">
                  <Upload size={13} /> Upload Contacts
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[auto_1fr_140px_70px_90px] md:grid-cols-[auto_1fr_160px_80px_110px_90px] gap-3 px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <div className="w-4" />
                <div>Contact</div>
                <div>Phone</div>
                <div className="text-center">Orders</div>
                <div>Revenue</div>
                <div className="hidden md:block">WhatsApp</div>
              </div>
              <div className="divide-y divide-slate-50">
                {displayed.slice(0, 100).map(c => (
                  <div key={c.id}
                    className={cn('grid grid-cols-[auto_1fr_140px_70px_90px] md:grid-cols-[auto_1fr_160px_80px_110px_90px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition',
                      selected.has(c.id) ? 'bg-[#25D366]/5' : '')}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="rounded border-slate-300 text-[#25D366] focus:ring-[#25D366]" />
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', avatarColor(c.phone))}>
                        {(c.name ?? c.phone).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name ?? <span className="text-slate-400 italic">No name</span>}</p>
                        <p className="text-xs text-slate-400 truncate">{c.email ?? ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 min-w-0">
                      <Phone size={10} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate font-mono">{c.phone}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-700">
                      <ShoppingBag size={11} className="text-slate-400" /> {c.total_orders}
                    </div>
                    <div className="text-sm font-semibold text-emerald-600">{formatCurrency(c.total_spent)}</div>
                    <div className="hidden md:block">
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full',
                        c.whatsapp_opt_in ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
                        {c.whatsapp_opt_in ? 'Opted in' : 'Not opted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {displayed.length > 100 && (
                <div className="px-4 py-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">Showing 100 of {displayed.length}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Smart segments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Filter size={14} className="text-[#25D366]" /> Smart Segments
            </h2>
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-400 cursor-not-allowed" title="Coming soon">
              <Plus size={12} /> Create Segment
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {SEGMENTS.slice(1).map(s => {
              const count = customers.filter(s.filter).length
              return (
                <div key={s.id} className="p-4 rounded-xl border border-slate-100 hover:border-[#25D366]/30 transition">
                  <p className="text-xl font-bold text-slate-900">{count.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">{s.label}</p>
                  <button onClick={() => setSegment(s.id)}
                    className="text-[11px] font-medium text-[#25D366] hover:underline flex items-center gap-1">
                    View segment →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, RefreshCw, Search, Phone, Mail, Building2,
  Copy, CheckCircle2, Clock, XCircle, Ban, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LandingLead {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string
  source: string
  payment_status: 'pending' | 'authenticated' | 'active' | 'failed' | 'cancelled'
  razorpay_subscription_id: string | null
  created_at: string
}

const STATUS_META: Record<LandingLead['payment_status'], { label: string; cls: string; icon: typeof Clock }> = {
  pending:       { label: 'Not paid yet',  cls: 'bg-slate-700/50 text-slate-300',   icon: Clock },
  authenticated: { label: 'Card added',    cls: 'bg-blue-900/40 text-blue-300',     icon: Clock },
  active:        { label: 'Paying',        cls: 'bg-green-900/40 text-green-400',   icon: CheckCircle2 },
  failed:        { label: 'Payment failed',cls: 'bg-red-900/40 text-red-400',       icon: XCircle },
  cancelled:     { label: 'Cancelled',     cls: 'bg-slate-800 text-slate-500',      icon: Ban },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function copy(text: string) { navigator.clipboard.writeText(text).catch(() => null) }

export default function LandingLeadsPage() {
  const router = useRouter()
  const [leads, setLeads]     = useState<LandingLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LandingLead['payment_status']>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/landing-leads')
    if (!res.ok) {
      if (res.status === 403) { router.replace('/admin/login'); return }
      setLoading(false)
      return
    }
    const data = await res.json() as { leads: LandingLead[] }
    setLeads(data.leads ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return leads
      .filter(l => statusFilter === 'all' || l.payment_status === statusFilter)
      .filter(l => !s || l.name.toLowerCase().includes(s) || l.email.toLowerCase().includes(s)
                      || l.phone.includes(s) || l.company_name?.toLowerCase().includes(s))
  }, [leads, search, statusFilter])

  const unpaidCount = leads.filter(l => l.payment_status === 'pending' || l.payment_status === 'failed').length

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0d1117]/95 backdrop-blur z-40">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-white">Landing Page Leads</span>
          {unpaidCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">
              {unpaidCount} to call
            </span>
          )}
        </div>
        <button onClick={load} title="Refresh" className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone, company…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-500 text-sm">No leads match.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => {
              const meta = STATUS_META[lead.payment_status]
              const Icon = meta.icon
              return (
                <div key={lead.id} className="bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-white font-semibold text-sm">{lead.name}</p>
                    {lead.company_name && (
                      <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {lead.company_name}
                      </p>
                    )}
                  </div>

                  <button onClick={() => { copy(lead.phone); setCopiedId(lead.id + '-phone') }}
                    className="flex items-center gap-1.5 text-slate-300 text-sm hover:text-white transition">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {lead.phone}
                    {copiedId === lead.id + '-phone' ? <CheckCircle2 className="w-3 h-3 text-[#25D366]" /> : <Copy className="w-3 h-3 opacity-40" />}
                  </button>

                  <button onClick={() => { copy(lead.email); setCopiedId(lead.id + '-email') }}
                    className="flex items-center gap-1.5 text-slate-300 text-sm hover:text-white transition">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {lead.email}
                    {copiedId === lead.id + '-email' ? <CheckCircle2 className="w-3 h-3 text-[#25D366]" /> : <Copy className="w-3 h-3 opacity-40" />}
                  </button>

                  <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0', meta.cls)}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>

                  <span className="text-slate-500 text-xs flex-shrink-0">{fmtDate(lead.created_at)}</span>

                  {lead.razorpay_subscription_id && (
                    <a
                      href={`https://dashboard.razorpay.com/app/subscriptions/${lead.razorpay_subscription_id}`}
                      target="_blank" rel="noreferrer"
                      className="text-slate-500 hover:text-[#25D366] transition flex-shrink-0"
                      title="View subscription in Razorpay"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <a href={`tel:${lead.phone}`}
                    className="flex-shrink-0 text-xs font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 px-3 py-1.5 rounded-lg transition">
                    Call
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

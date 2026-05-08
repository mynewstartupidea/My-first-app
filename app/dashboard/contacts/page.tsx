'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Loader2, Search, CheckCircle2, XCircle } from 'lucide-react'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { Customer } from '@/types'

export default function ContactsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const supabase = createClient()

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!store) { setLoading(false); return }
    const { data } = await supabase
      .from('customers').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(200)
    setCustomers(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const filtered = customers.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.phone.includes(s) || (c.name?.toLowerCase().includes(s)) || (c.email?.toLowerCase().includes(s))
  })

  const optedIn = customers.filter(c => c.whatsapp_opt_in).length

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <p className="text-slate-500 text-sm mt-1">Customers synced from your Shopify store</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Contacts',  value: customers.length, sub: 'Synced from Shopify' },
          { label: 'WhatsApp Opt-in', value: optedIn,          sub: 'Can receive messages' },
          { label: 'Opt-in Rate',     value: customers.length ? `${Math.round((optedIn / customers.length) * 100)}%` : '—', sub: 'Consent rate' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{s.label}</p>
            <p className="text-xs text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm mb-5 max-w-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone or email…"
          className="text-sm text-slate-700 outline-none w-full placeholder:text-slate-400"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700">No contacts yet</p>
            <p className="text-slate-400 text-sm mt-1">Customers sync automatically when your Shopify store is connected</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1.5fr,1fr,1fr,80px,80px,100px] text-xs font-semibold text-slate-400 uppercase tracking-wide px-6 py-3 border-b border-slate-100 bg-slate-50">
              <span>Name</span><span>Phone</span><span>Email</span>
              <span>Orders</span><span>Spent</span><span>WhatsApp</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map(c => (
                <div key={c.id} className="grid grid-cols-[1.5fr,1fr,1fr,80px,80px,100px] items-center px-6 py-3.5 hover:bg-slate-50 transition">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name ?? '—'}</p>
                  <p className="text-sm text-slate-500">{c.phone}</p>
                  <p className="text-sm text-slate-400 truncate">{c.email ?? '—'}</p>
                  <p className="text-sm text-slate-600">{c.total_orders}</p>
                  <p className="text-sm text-slate-600">{formatCurrency(c.total_spent)}</p>
                  <div className="flex items-center gap-1">
                    {c.whatsapp_opt_in
                      ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-600">Opted in</span></>
                      : <><XCircle className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs text-slate-400">Opted out</span></>
                    }
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

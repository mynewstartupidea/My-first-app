'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Search, UserCheck, TrendingUp, ShoppingBag, Loader2, ArrowRight, RefreshCw } from 'lucide-react'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { Customer } from '@/types'
import Link from 'next/link'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [hasStore, setHasStore]   = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()

    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', store.id)
      .order('total_spent', { ascending: false })
      .limit(300)

    setCustomers(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.phone.includes(s) || (c.name?.toLowerCase().includes(s)) || (c.email?.toLowerCase().includes(s))
  })

  const optInCount = customers.filter(c => c.whatsapp_opt_in).length
  const optInRate  = customers.length ? Math.round((optInCount / customers.length) * 100) : 0

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">Your customer base synced from your ecommerce store</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-slate-500 text-sm">Total Customers</span>
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
          <p className="text-slate-400 text-xs mt-1">Synced from store</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-slate-500 text-sm">WhatsApp Opt-ins</span>
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{optInCount}</p>
          <p className="text-slate-400 text-xs mt-1">Eligible for messages</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-slate-500 text-sm">Opt-in Rate</span>
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{optInRate}%</p>
          <p className="text-slate-400 text-xs mt-1">of all customers</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
        </div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <Users className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store to sync customers</p>
          <p className="text-amber-700 text-sm mt-1">Customer data is synced automatically once your store is connected.</p>
          <Link href="/dashboard/integrations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900">
            Connect store <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-slate-700">{search ? 'No results found' : 'No customers yet'}</p>
          <p className="text-slate-400 text-sm mt-1">
            {search ? 'Try a different search term.' : 'Customers sync automatically from your connected store.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs">Customer</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs">Phone</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden md:table-cell">Orders</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden md:table-cell">Total Spent</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs hidden lg:table-cell">Last Order</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center font-bold text-[#25D366] text-xs flex-shrink-0">
                          {c.name ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : c.phone.slice(-2)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{c.name ?? '—'}</p>
                          <p className="text-xs text-slate-400 hidden sm:block">{c.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{c.phone}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-400" /> {c.total_orders}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell font-medium text-slate-800">
                      {formatCurrency(Number(c.total_spent))}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-500 text-xs">
                      {c.last_order_at ? timeAgo(c.last_order_at) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.whatsapp_opt_in ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Opted in
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full">Opted out</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length < customers.length && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
              Showing {filtered.length} of {customers.length} customers
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  IndianRupee, MessageSquare, ShoppingCart,
  CheckCircle, TrendingUp, ArrowRight, Zap,
  Store, AlertCircle
} from 'lucide-react'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Fetch last 30 days analytics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: analytics } = store ? await supabase
    .from('analytics_daily')
    .select('*')
    .eq('store_id', store.id)
    .gte('date', thirtyDaysAgo) : { data: [] }

  const stats = (analytics ?? []).reduce(
    (acc, row) => ({
      revenue_recovered: acc.revenue_recovered + Number(row.revenue_recovered),
      messages_sent:     acc.messages_sent     + row.messages_sent,
      carts_recovered:   acc.carts_recovered   + row.carts_recovered,
      cod_verified:      acc.cod_verified      + row.cod_verified,
    }),
    { revenue_recovered: 0, messages_sent: 0, carts_recovered: 0, cod_verified: 0 }
  )

  // Recent messages
  const { data: recentMessages } = store ? await supabase
    .from('messages')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(8) : { data: [] }

  // Active automations count
  const { count: activeAutomations } = store ? await supabase
    .from('automations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('is_enabled', true) : { count: 0 }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const statCards = [
    {
      label: 'Revenue Recovered',
      value: formatCurrency(stats.revenue_recovered),
      icon: IndianRupee,
      color: 'bg-green-50 text-green-600',
      iconBg: 'bg-green-100',
      sub: 'Last 30 days',
    },
    {
      label: 'Messages Sent',
      value: formatNumber(stats.messages_sent),
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
      sub: 'Last 30 days',
    },
    {
      label: 'Carts Recovered',
      value: formatNumber(stats.carts_recovered),
      icon: ShoppingCart,
      color: 'bg-orange-50 text-orange-600',
      iconBg: 'bg-orange-100',
      sub: 'Last 30 days',
    },
    {
      label: 'COD Verified',
      value: formatNumber(stats.cod_verified),
      icon: CheckCircle,
      color: 'bg-purple-50 text-purple-600',
      iconBg: 'bg-purple-100',
      sub: 'Last 30 days',
    },
  ]

  const typeLabels: Record<string, string> = {
    abandoned_cart:    'Abandoned Cart',
    cod_verification:  'COD Verification',
    order_confirmation:'Order Confirmation',
    shipping_update:   'Shipping Update',
  }

  const statusColors: Record<string, string> = {
    sent:      'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    read:      'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}{store?.shop_name ? `, ${store.shop_name}` : ''}! 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeAutomations
              ? `${activeAutomations} automation${activeAutomations > 1 ? 's' : ''} running · recovering revenue 24/7`
              : 'Set up automations to start recovering revenue'}
          </p>
        </div>
        <Link
          href="/dashboard/automations"
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
        >
          <Zap className="w-4 h-4" />
          Manage Automations
        </Link>
      </div>

      {/* No store banner */}
      {!store && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Connect your Shopify store to get started</p>
            <p className="text-amber-700 text-sm mt-0.5">Once connected, automations will start running and recovering lost revenue.</p>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-700 hover:text-amber-900"
            >
              <Store className="w-3.5 h-3.5" /> Connect Store <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <span className="text-slate-500 text-sm font-medium">{card.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <card.icon className={`w-4.5 h-4.5 ${card.color.split(' ')[1]}`} size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-slate-400 text-xs mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent messages */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Messages</h2>
            <Link href="/dashboard/messages" className="text-[#25D366] text-sm font-medium flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentMessages && recentMessages.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {recentMessages.map(msg => (
                <div key={msg.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{msg.customer_name ?? msg.customer_phone}</p>
                    <p className="text-xs text-slate-400 truncate">{msg.message.slice(0, 60)}…</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[msg.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {msg.status}
                    </span>
                    <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="font-medium text-slate-700">No messages yet</p>
              <p className="text-slate-400 text-sm mt-1">Enable automations to start sending WhatsApp messages</p>
              <Link href="/dashboard/automations" className="mt-4 text-sm text-[#25D366] font-medium hover:underline flex items-center gap-1">
                Set up automations <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Quick stats sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#25D366]" /> Performance
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Cart Recovery Rate', value: stats.messages_sent > 0 ? `${Math.round((stats.carts_recovered / stats.messages_sent) * 100)}%` : '—' },
                { label: 'COD Confirm Rate',   value: stats.cod_verified > 0 ? `${stats.cod_verified} orders` : '—' },
                { label: 'Avg. Revenue/Cart',  value: stats.carts_recovered > 0 ? formatCurrency(stats.revenue_recovered / stats.carts_recovered) : '—' },
                { label: 'Total Messages',     value: formatNumber(stats.messages_sent) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">{label}</span>
                  <span className="text-slate-800 font-semibold text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] rounded-2xl p-5 text-white">
            <Zap className="w-5 h-5 mb-3 opacity-80" />
            <p className="font-semibold">COD Verification</p>
            <p className="text-green-100 text-sm mt-1">Reduce RTO losses by verifying COD orders before dispatch.</p>
            <Link href="/dashboard/automations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white hover:underline">
              Enable now <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

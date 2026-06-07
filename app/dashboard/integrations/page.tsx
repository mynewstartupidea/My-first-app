import { Plug, CheckCircle2, ArrowRight, Store, MessageCircle, Zap, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const integrations = [
  {
    id: 'shopify',
    name: 'Shopify',
    desc: 'Sync orders, customers, and abandoned carts from your Shopify store.',
    logo: '🛍️',
    status: 'available',
    category: 'Ecommerce',
    href: '/dashboard/settings',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    desc: 'Connect your WordPress WooCommerce store to automate WhatsApp messaging.',
    logo: '🛒',
    status: 'coming_soon',
    category: 'Ecommerce',
    href: null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    desc: 'Send automated messages via Interakt, Gupshup, or other BSPs.',
    logo: '💬',
    status: 'available',
    category: 'Messaging',
    href: '/dashboard/settings',
  },
  {
    id: 'interakt',
    name: 'Interakt',
    desc: 'Premium WhatsApp Business Solution Provider with template management.',
    logo: '⚡',
    status: 'available',
    category: 'BSP',
    href: '/dashboard/settings',
  },
  {
    id: 'gupshup',
    name: 'Gupshup',
    desc: 'Enterprise-grade WhatsApp messaging with advanced analytics.',
    logo: '📡',
    status: 'available',
    category: 'BSP',
    href: '/dashboard/settings',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    desc: 'Send payment links and transaction notifications via WhatsApp.',
    logo: '💳',
    status: 'coming_soon',
    category: 'Payments',
    href: null,
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    desc: 'Trigger WhatsApp shipping updates automatically from Shiprocket.',
    logo: '🚚',
    status: 'coming_soon',
    category: 'Logistics',
    href: null,
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    desc: 'Automated order tracking notifications via Delhivery.',
    logo: '📦',
    status: 'coming_soon',
    category: 'Logistics',
    href: null,
  },
]

const statusConfig = {
  available:   { label: 'Available', style: 'bg-green-100 text-green-700' },
  connected:   { label: 'Connected', style: 'bg-[#25D366]/10 text-[#25D366]' },
  coming_soon: { label: 'Coming Soon', style: 'bg-slate-100 text-slate-500' },
}

const categories = ['All', 'Ecommerce', 'Messaging', 'BSP', 'Payments', 'Logistics']

export default function IntegrationsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">Connect Wapaci with your ecommerce stack</p>
        </div>
      </div>

      {/* Quick setup banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-800">Connect your store to get started</p>
          <p className="text-amber-700 text-sm mt-0.5">
            Wapaci needs to be connected to your ecommerce store and WhatsApp BSP before automations can run.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            <Store className="w-3.5 h-3.5" /> Go to Settings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat, i) => (
          <button
            key={cat}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${i === 0 ? 'bg-[#25D366] text-white' : 'text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(intg => {
          const status = statusConfig[intg.status as keyof typeof statusConfig]
          return (
            <div key={intg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-2xl border border-slate-100">
                    {intg.logo}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{intg.name}</p>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{intg.category}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${status.style}`}>
                  {status.label}
                </span>
              </div>

              <p className="text-slate-500 text-sm leading-relaxed flex-1">{intg.desc}</p>

              <div className="mt-4">
                {intg.status === 'available' && intg.href ? (
                  <Link
                    href={intg.href}
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                  >
                    <Plug className="w-4 h-4" /> Connect
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-medium px-4 py-2.5 rounded-xl cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Request integration */}
      <div className="mt-8 bg-white/50 border border-slate-200 rounded-2xl p-6 text-center">
        <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-700">Don&apos;t see your platform?</p>
        <p className="text-slate-500 text-sm mt-1">Let us know what you need. We&apos;re adding new integrations based on customer requests.</p>
        <a
          href="mailto:support@wapaci.com?subject=Integration Request"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline"
        >
          <MessageCircle className="w-4 h-4" /> Request an integration
        </a>
      </div>
    </div>
  )
}

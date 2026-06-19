'use client'

import Link from 'next/link'
import { MessageCircle, CheckCircle2, ArrowRight, Zap, ShoppingCart, TrendingUp, Phone } from 'lucide-react'

interface Props {
  connected:   boolean
  phone?:      string | null
  tokenType?:  string | null
}

export default function WhatsAppStatusBanner({ connected, phone, tokenType }: Props) {
  if (connected && phone) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mb-7">
        <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageCircle size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
            <p className="font-semibold text-emerald-800 text-sm">WhatsApp connected</p>
            {tokenType === 'system_user_token' && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Permanent token</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Phone size={11} className="text-emerald-600" />
            <p className="text-emerald-700 text-sm font-mono">{phone}</p>
          </div>
        </div>
        <Link href="/dashboard/settings?tab=whatsapp"
          className="text-emerald-700 hover:text-emerald-900 text-xs font-medium flex items-center gap-1 flex-shrink-0 transition">
          Manage <ArrowRight size={12} />
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-[#075E54]/5 via-white to-[#25D366]/5 border-2 border-dashed border-[#25D366]/30 rounded-2xl p-7 mb-7">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#25D366]/20">
          <MessageCircle size={28} className="text-white" />
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Connect your WhatsApp Business account</h2>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">
            Link your WhatsApp number to start recovering abandoned carts, sending order updates, and automating customer conversations — all from one place.
          </p>
          <div className="flex flex-wrap gap-4 mt-3">
            {[
              { icon: ShoppingCart, text: 'Recover abandoned carts' },
              { icon: Zap,          text: 'Automate order messages' },
              { icon: TrendingUp,   text: 'Track revenue per message' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon size={12} className="text-[#25D366]" /> {text}
              </span>
            ))}
          </div>
        </div>

        <Link
          href="/dashboard/settings?tab=whatsapp"
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1aad54] text-white font-semibold px-5 py-3 rounded-xl text-sm transition shadow-md shadow-[#25D366]/20 flex-shrink-0 whitespace-nowrap"
        >
          <MessageCircle size={16} /> Connect WhatsApp
        </Link>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { MessageCircle, ShoppingCart, CreditCard, Package, BarChart3 } from 'lucide-react'

// Real numbers already live on the homepage (components/landing/social-proof.tsx,
// components/landing/hero.tsx) — reused here rather than inventing new ones,
// same two the hero leads with.
const STATS = [
  { value: '340+', label: 'Businesses on Wapaci' },
  { value: '1.2M+', label: 'Messages sent' },
]

// Condensed from components/landing/features.tsx — four of the six, trimmed
// to one line each. This panel is a trust/context aside next to a form,
// not the full features section, so it doesn't need all six or the longer
// copy that section uses.
const FEATURES = [
  { icon: ShoppingCart, title: 'Abandoned Cart Recovery', desc: 'Automatic follow-ups that bring shoppers back.' },
  { icon: CreditCard,   title: 'Appointment Reminders',   desc: 'Cut no-shows with automatic WhatsApp reminders.' },
  { icon: Package,      title: 'Broadcasts & Promotions', desc: 'Reach your whole list in one click.' },
  { icon: BarChart3,    title: 'Live Analytics',          desc: 'Messages, replies and revenue in one view.' },
]

// Shared left-side marketing panel for /signup and /login — desktop/laptop
// only (hidden below lg). The two auth pages previously had nothing but a
// logo and a bare form, with none of the social proof or feature context
// the rest of the marketing site already carries.
export default function AuthMarketingPanel() {
  return (
    <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-shrink-0 flex-col justify-between bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] p-10 xl:p-12 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-[#25D366]" />
          </div>
          <span className="text-white font-bold text-xl">Wapaci</span>
        </Link>

        <h2 className="mt-12 text-4xl xl:text-[2.75rem] font-extrabold text-white leading-[1.12] tracking-tight text-balance">
          Turn WhatsApp into <span className="italic text-green-100">your best</span> salesperson
        </h2>
        <p className="mt-4 text-green-100/80 text-[15px] leading-relaxed max-w-sm">
          Automate cart recovery, reminders, broadcasts and win-backs — no code, live in minutes.
        </p>

        <div className="flex items-center gap-8 mt-10">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-2xl font-extrabold text-white tabular-nums">{s.value}</p>
              <p className="text-green-100/70 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 space-y-5 mt-12">
        {FEATURES.map(f => (
          <div key={f.title} className="flex items-start gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <f.icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{f.title}</p>
              <p className="text-green-100/70 text-xs mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Compact mobile-only header — the full panel above is hidden below lg (no
// room for a side-by-side layout), but a mobile signup/login shouldn't just
// revert to a bare logo either. A short gradient band with the logo and one
// trust stat keeps some brand presence without eating the limited vertical
// space a phone has for the actual form below it.
export function AuthMobileHeader() {
  return (
    <div className="lg:hidden bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] px-6 pt-8 pb-9 text-center rounded-b-[2rem] relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <Link href="/" className="relative z-10 inline-flex items-center gap-2">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
        </div>
        <span className="text-white font-bold text-lg">Wapaci</span>
      </Link>
      <p className="relative z-10 text-green-100/80 text-xs mt-2">340+ businesses growing on WhatsApp</p>
    </div>
  )
}

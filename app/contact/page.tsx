import Link from 'next/link'
import { MessageCircle, Mail, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Contact Us – Wapaci',
  description: 'Get in touch with the Wapaci team for support, sales, or billing questions.',
}

function NavBar() {
  return (
    <header className="bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-105 transition">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Wapaci</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-semibold bg-[#25D366] hover:bg-[#1db954] text-white px-4 py-2 rounded-xl transition shadow-lg shadow-green-500/20"
        >
          Get started free
        </Link>
      </div>
    </header>
  )
}

const contacts = [
  {
    label: 'General Support',
    email: 'support@wapaci.com',
    desc: 'Questions about your account, automations, or technical issues.',
    color: 'bg-[#25D366]/10 border-[#25D366]/20',
    accent: 'text-[#25D366]',
  },
  {
    label: 'Sales',
    email: 'support@wapaci.com',
    desc: 'Discuss pricing, plans, or get help choosing the right option for your store.',
    color: 'bg-blue-500/10 border-blue-500/20',
    accent: 'text-blue-400',
  },
  {
    label: 'Billing & Refunds',
    email: 'support@wapaci.com',
    desc: 'Invoice queries, subscription changes, and refund requests.',
    color: 'bg-purple-500/10 border-purple-500/20',
    accent: 'text-purple-400',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-20">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Get in touch</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold text-white">
            Contact Us
          </h1>
          <p className="mt-4 text-slate-400 text-lg leading-relaxed max-w-xl mx-auto">
            We&apos;re here to help. Reach out to the right team and we&apos;ll get back to you within one business day.
          </p>
        </div>

        {/* Contact cards */}
        <div className="space-y-4 mb-14">
          {contacts.map(({ label, email, desc, color, accent }) => (
            <div
              key={label}
              className={`rounded-2xl border p-6 ${color} flex flex-col sm:flex-row sm:items-center gap-4`}
            >
              <div className="flex-1">
                <p className={`font-semibold text-base ${accent}`}>{label}</p>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{desc}</p>
              </div>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition flex-shrink-0 group"
              >
                <Mail className="w-4 h-4" />
                {email}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </a>
            </div>
          ))}
        </div>

        {/* Response time note */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 text-center">
          <p className="text-slate-300 font-medium">Typical response time</p>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Support & billing: within 24 hours on business days.<br />
            Sales enquiries: within a few hours during IST business hours (Mon–Sat, 10am–7pm).
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/privacy-policy" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
            <span>·</span>
            <Link href="/refund-policy" className="hover:text-slate-400 transition">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

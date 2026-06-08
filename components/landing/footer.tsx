import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-[#070b12] border-t border-white/5 py-12">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-3 group w-fit">
              <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-105 transition">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl">Wapaci</span>
            </Link>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
              WhatsApp revenue automation for ecommerce brands. Recover carts, verify COD, update customers — all on autopilot.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Product</p>
            <div className="space-y-2.5">
              {[
                { href: '#features', label: 'Features' },
                { href: '#how-it-works', label: 'How it works' },
                { href: '#use-cases', label: 'Use Cases' },
                { href: '#faq', label: 'FAQ' },
                { href: 'https://cal.com/wapaci/demo', label: 'Book Demo' },
                { href: '/login', label: 'Login / Dashboard' },
              ].map(({ href, label }) => (
                <div key={label}>
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="text-slate-500 hover:text-white text-sm transition block"
                  >{label}</a>
                </div>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Company</p>
            <div className="space-y-2.5">
              {[
                { href: '/contact', label: 'Contact Us' },
                { href: '/privacy-policy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms of Service' },
                { href: '/refund-policy', label: 'Refund Policy' },
              ].map(({ href, label }) => (
                <div key={label}>
                  <Link href={href} className="text-slate-500 hover:text-white text-sm transition block">{label}</Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} Wapaci. All rights reserved. Built for Indian D2C brands.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-slate-600 text-xs">🇮🇳 Made in India</span>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-slate-600 text-xs">Powered by WhatsApp Business API</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

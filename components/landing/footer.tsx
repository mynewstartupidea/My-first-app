'use client'

import Link from 'next/link'
import { scrollToSection } from '@/lib/scroll-to-section'

export default function Footer() {
  return (
    <footer className="bg-[#070b12] border-t border-white/5 py-12">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-3 group w-fit">
              <img src="/logo-square.svg" alt="Wapaci" className="w-9 h-9 rounded-xl shadow-lg shadow-green-500/20 group-hover:scale-105 transition" />
              <span className="text-white font-bold text-xl">Wapaci</span>
            </Link>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
              WhatsApp marketing automation for businesses of every kind — e-commerce, clinics, gyms, coaches and more. All on autopilot.
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
                { href: '/login', label: 'Login / Dashboard' },
              ].map(({ href, label }) => (
                <div key={label}>
                  <a
                    href={href}
                    onClick={href.startsWith('#') ? e => scrollToSection(href.slice(1), e) : undefined}
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
                { href: '/data-deletion', label: 'Data Deletion' },
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
            © {new Date().getFullYear()} Wapaci. All rights reserved. Built for Indian businesses.
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

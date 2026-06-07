'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'
    )}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-105 transition">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Wapaci</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {[
            { href: '#features', label: 'Features' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#use-cases', label: 'Use Cases' },
            { href: '#faq', label: 'FAQ' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-slate-400 hover:text-white text-sm font-medium transition"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition font-medium">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold bg-[#25D366] hover:bg-[#1db954] text-white px-4 py-2 rounded-xl transition shadow-lg shadow-green-500/20"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4 space-y-3">
          {[
            { href: '#features', label: 'Features' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#use-cases', label: 'Use Cases' },
            { href: '#faq', label: 'FAQ' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block text-slate-300 hover:text-white text-sm font-medium py-1 transition"
            >
              {label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2 border-t border-white/10">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white py-1 transition">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-semibold bg-[#25D366] text-white px-4 py-2 rounded-xl text-center">
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

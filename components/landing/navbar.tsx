'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scrollToSection } from '@/lib/scroll-to-section'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#use-cases', label: 'Use Cases' },
  { href: '/pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleSectionClick(id: string, e: React.MouseEvent) {
    setOpen(false)
    scrollToSection(id, e)
  }

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'
    )}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img src="/logo-square.svg" alt="Wapaci" className="w-9 h-9 rounded-xl shadow-lg shadow-green-500/30 group-hover:scale-105 transition" />
          <span className="text-white font-bold text-xl tracking-tight">Wapaci</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => (
            href.startsWith('/') ? (
              <Link key={href} href={href} className="text-slate-400 hover:text-white text-sm font-medium transition">
                {label}
              </Link>
            ) : (
              <a key={href} href={href} onClick={e => handleSectionClick(href.slice(1), e)} className="text-slate-400 hover:text-white text-sm font-medium transition">
                {label}
              </a>
            )
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
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4 space-y-3">
          {NAV_LINKS.map(({ href, label }) => (
            href.startsWith('/') ? (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="block text-slate-300 hover:text-white text-sm font-medium py-1 transition">
                {label}
              </Link>
            ) : (
              <a key={href} href={href} onClick={e => handleSectionClick(href.slice(1), e)} className="block text-slate-300 hover:text-white text-sm font-medium py-1 transition">
                {label}
              </a>
            )
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

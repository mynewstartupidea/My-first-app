'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WaHealth {
  connected: boolean
  quality_rating?: string
  messaging_limit_tier?: string
  display_phone_number?: string
}

// Business-critical alert — a restricted or degrading WhatsApp account
// directly threatens a merchant's ability to send messages. Previously only
// rendered in the desktop sidebar (hidden md:flex), so a mobile-only
// merchant/rep had zero visibility into this until messages silently
// started failing.
export default function WaHealthBadge({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [health, setHealth] = useState<WaHealth | null>(null)

  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/whatsapp/health')
        .then(r => r.json())
        .then((d: WaHealth) => setHealth(d))
        .catch(() => {})

    fetch_()
    const id = setInterval(fetch_, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!health?.connected) return null
  const rating = health.quality_rating ?? 'GREEN'
  if (rating === 'GREEN') return null

  const isRed = rating === 'RED'

  return (
    <Link
      href="/dashboard/settings?tab=whatsapp"
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition',
        variant === 'dark'
          ? (isRed ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20')
          : cn('mb-5', isRed ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100')
      )}
      title={isRed ? 'WhatsApp account restricted — click for details' : 'WhatsApp quality dropping — click for details'}
    >
      <ShieldAlert size={12} className="flex-shrink-0" />
      <span>{isRed ? 'WA Restricted' : 'WA Quality ↓'}</span>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ml-auto',
        isRed ? 'bg-red-400' : 'bg-amber-400')} />
    </Link>
  )
}

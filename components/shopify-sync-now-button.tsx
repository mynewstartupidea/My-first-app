'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function ShopifySyncNowButton() {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setSyncing(true)
    try {
      await fetch('/api/shopify/sync-all', { method: 'POST' })
    } finally {
      setSyncing(false)
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={syncing}
      className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-60"
    >
      {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      {syncing ? 'Syncing…' : 'Sync Now'}
    </button>
  )
}

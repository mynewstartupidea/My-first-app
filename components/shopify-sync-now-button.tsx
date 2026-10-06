'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'

export default function ShopifySyncNowButton() {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setSyncing(true)
    setError(null)
    try {
      // The click previously ignored the response entirely — a failure here
      // (no store connected, Shopify auth broken, etc.) left the button
      // silently returning to "Sync Now" with zero indication anything had
      // gone wrong, while the merchant kept waiting for data that was never
      // going to arrive.
      const res = await fetch('/api/shopify/sync-all', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not start the sync. Please try again.')
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSyncing(false)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={syncing}
        className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-60"
      >
        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 max-w-xs text-right">
          <AlertCircle size={12} className="flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

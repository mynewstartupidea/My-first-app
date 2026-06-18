'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'

const REASONS = [
  { value: 'too_expensive',    label: "It's too expensive" },
  { value: 'not_using',        label: "I'm not using it enough" },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'switching',        label: "Switching to another tool" },
  { value: 'shopify_issues',   label: 'Issues with Shopify integration' },
  { value: 'whatsapp_issues',  label: 'WhatsApp setup is too complex' },
  { value: 'other',            label: 'Other' },
]

export default function CancelSubscriptionButton() {
  const [open,    setOpen]    = useState(false)
  const [reason,  setReason]  = useState('')
  const [detail,  setDetail]  = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleCancel() {
    if (!reason) { setError('Please select a reason.'); return }
    setLoading(true)
    setError('')
    const res  = await fetch('/api/billing/cancel', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason, detail }),
    })
    const data = await res.json() as { success?: boolean; error?: string }
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed to cancel subscription'); return }
    setDone(true)
  }

  return (
    <>
      <div className="mt-8 text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-slate-400 hover:text-red-400 underline underline-offset-2 transition"
        >
          Cancel subscription
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => { setOpen(false); setDone(false); setReason(''); setDetail(''); setError('') }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            {done ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">👋</span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">Subscription cancelled</h3>
                <p className="text-slate-500 text-sm">
                  Your plan stays active until the end of the current billing period.
                  We&apos;re sorry to see you go — thank you for using Wapaci.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-slate-900 text-lg mb-1">Before you go…</h3>
                <p className="text-slate-500 text-sm mb-5">
                  Help us improve by telling us why you&apos;re leaving. Your subscription stays active until the end of the billing period.
                </p>

                <div className="space-y-2 mb-4">
                  {REASONS.map(r => (
                    <label key={r.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        reason === r.value
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <input
                        type="radio"
                        name="cancel_reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-red-500"
                      />
                      <span className="text-sm text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>

                <textarea
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  placeholder="Anything else you'd like to share? (optional)"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
                />

                {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Keep subscription
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                  >
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Cancelling…</> : 'Cancel subscription'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

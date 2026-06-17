'use client'

import { useState } from 'react'

interface MetaResult {
  status:  number
  ok:      boolean
  body:    unknown
  url:     string
  phoneId: string
}

export default function TestWhatsAppPage() {
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<MetaResult | null>(null)
  const [apiErr,  setApiErr]  = useState<string | null>(null)

  async function send() {
    setLoading(true)
    setResult(null)
    setApiErr(null)

    try {
      const res  = await fetch('/api/admin/test-whatsapp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to: phone }),
      })
      const data = await res.json() as MetaResult & { error?: string }

      if (!res.ok && data.error) {
        setApiErr(data.error)
      } else {
        setResult(data)
      }
    } catch (e) {
      setApiErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  const statusColor =
    result === null        ? ''
    : result.ok            ? 'text-green-400'
    : result.status >= 400 ? 'text-red-400'
    :                        'text-amber-400'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-bold text-white">WhatsApp Cloud API — send test</h1>
          <p className="text-sm text-gray-400 mt-1">
            Uses <code className="bg-gray-800 px-1 rounded">META_ACCESS_TOKEN</code> +{' '}
            <code className="bg-gray-800 px-1 rounded">META_PHONE_NUMBER_ID</code> from Vercel env.
            No merchant account involved.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Recipient phone number
            <span className="ml-2 text-xs text-gray-500">
              (must be added as a test number in Meta App Dashboard if app is in Dev mode)
            </span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && phone && send()}
            placeholder="e.g. 919876543210"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white
                       placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
                       font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            Include country code, no + or spaces. India example: 919876543210
          </p>
        </div>

        <button
          onClick={send}
          disabled={loading || !phone.trim()}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500
                     text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Sending…' : 'Send test message'}
        </button>

        {apiErr && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4">
            <p className="text-red-300 text-sm font-semibold mb-1">Server error</p>
            <p className="text-red-400 text-sm font-mono">{apiErr}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">

            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold font-mono ${statusColor}`}>
                {result.status}
              </span>
              <span className={`text-sm font-semibold ${statusColor}`}>
                {result.ok ? 'Success' : 'Failed'}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-mono">URL</p>
              <p className="text-xs text-gray-300 font-mono break-all bg-gray-900 p-2 rounded">
                {result.url}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-mono">Phone Number ID</p>
              <p className="text-xs text-gray-300 font-mono bg-gray-900 p-2 rounded">
                {result.phoneId}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-mono">Response body</p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs
                              text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(result.body, null, 2)}
              </pre>
            </div>

            {!result.ok && result.body && typeof result.body === 'object' && (result.body as Record<string, unknown>).error && (
              <div className="bg-red-950 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 text-sm font-semibold mb-2">Meta error detail</p>
                <pre className="text-red-400 text-xs font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify((result.body as Record<string, unknown>).error, null, 2)}
                </pre>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}

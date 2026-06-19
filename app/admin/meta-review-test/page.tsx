'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface StepResult {
  step:       string
  url:        string
  status:     number | null
  ok:         boolean
  body:       unknown
  error?:     string
  durationMs: number
}

interface ApiResponse {
  token_source:   string
  granted_scopes: string[]
  has_wba_mgmt:   boolean
  has_wa_msg:     boolean
  results:        StepResult[]
  summary:        { total: number; ok: number; failed: number }
  error?:         string
}

const REQUIRED_SCOPES = ['whatsapp_business_management', 'whatsapp_business_messaging']

export default function MetaReviewTestPage() {
  const [loading,   setLoading]   = useState(false)
  const [data,      setData]      = useState<ApiResponse | null>(null)
  const [expanded,  setExpanded]  = useState<number | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setData(null)
    setError(null)
    setExpanded(null)
    try {
      const res  = await fetch('/api/admin/meta-review-test')
      const json = await res.json() as ApiResponse
      if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return }
      setData(json)
      // Auto-expand failed steps
      const firstFail = json.results.findIndex(r => !r.ok)
      if (firstFail >= 0) setExpanded(firstFail)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6 font-mono">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-500 hover:text-white flex items-center gap-1 text-sm font-sans">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div>
            <h1 className="text-white font-bold text-xl font-sans">Meta App Review — API Call Test</h1>
            <p className="text-slate-500 text-xs font-sans mt-0.5">
              Fires the exact Graph API calls Meta needs to register for App Review using the stored Embedded Signup token.
            </p>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition mb-8 font-sans"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Meta API calls…</>
            : <><RefreshCw className="w-4 h-4" /> Run Meta Review Test</>}
        </button>

        {/* Top-level error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm font-sans">
            <p className="font-bold mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Token source',  value: data.token_source.includes('whatsapp_accounts') ? 'OAuth (Embedded Signup)' : 'Static env var ⚠', ok: data.token_source.includes('whatsapp_accounts') },
                { label: 'Calls passed',  value: `${data.summary.ok} / ${data.summary.total}`, ok: data.summary.failed === 0 },
                { label: 'whatsapp_business_management', value: data.has_wba_mgmt ? '✓ Granted' : '✗ Missing', ok: data.has_wba_mgmt },
                { label: 'whatsapp_business_messaging',  value: data.has_wa_msg  ? '✓ Granted' : '✗ Missing', ok: data.has_wa_msg  },
              ].map(({ label, value, ok }) => (
                <div key={label} className={cn('rounded-xl p-3 border font-sans', ok ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30')}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className={cn('text-sm font-bold', ok ? 'text-green-300' : 'text-red-300')}>{value}</p>
                </div>
              ))}
            </div>

            {/* Token source detail */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 mb-4 text-xs text-slate-400 font-sans">
              <span className="text-slate-300 font-semibold">Token: </span>{data.token_source}
            </div>

            {/* Granted scopes */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 mb-6 font-sans">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Granted scopes</p>
              <div className="flex flex-wrap gap-2">
                {data.granted_scopes.length === 0
                  ? <span className="text-red-400 text-sm">No scopes returned</span>
                  : data.granted_scopes.map(s => (
                    <span key={s} className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      REQUIRED_SCOPES.includes(s) ? 'bg-green-900/40 text-green-300 border border-green-500/30' : 'bg-white/5 text-slate-400'
                    )}>
                      {s}
                    </span>
                  ))}
              </div>
            </div>

            {/* Step-by-step results */}
            <div className="space-y-3">
              {data.results.map((r, i) => (
                <div key={i} className={cn('border rounded-xl overflow-hidden', r.ok ? 'border-green-500/20' : 'border-red-500/30')}>

                  {/* Step header */}
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition"
                  >
                    <div className="flex items-center gap-3">
                      {r.ok
                        ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        : <XCircle      className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <div>
                        <p className="text-sm text-white font-sans font-medium">{r.step}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{r.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded font-sans',
                        r.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                      )}>
                        {r.status ?? 'ERR'}
                      </span>
                      <span className="text-slate-600 text-xs">{r.durationMs}ms</span>
                      {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {/* Expanded: raw JSON */}
                  {expanded === i && (
                    <div className="border-t border-white/8 bg-black/30 p-4">
                      {r.error && (
                        <p className="text-red-400 text-xs mb-3 font-sans">{r.error}</p>
                      )}
                      <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                        {JSON.stringify(r.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Instructions for Meta App Review */}
            {data.summary.ok === data.summary.total && data.has_wba_mgmt && data.has_wa_msg && (
              <div className="mt-6 bg-green-900/10 border border-green-500/20 rounded-xl p-5 font-sans">
                <p className="text-green-300 font-bold mb-2">All calls succeeded with required scopes</p>
                <p className="text-slate-400 text-sm">
                  Meta should now register these API calls against your app. Go to{' '}
                  <span className="text-white font-mono">Meta App Dashboard → App Review → Permissions and Features</span>
                  {' '}and check if the &quot;0 of 1 API calls required&quot; counter has updated.
                  Meta can take up to 24h to reflect the calls.
                </p>
              </div>
            )}

            {(!data.has_wba_mgmt || !data.has_wa_msg) && (
              <div className="mt-6 bg-amber-900/10 border border-amber-500/20 rounded-xl p-5 font-sans">
                <p className="text-amber-300 font-bold mb-2">Missing required scopes</p>
                <p className="text-slate-400 text-sm">
                  The token does not have <code className="text-amber-300">whatsapp_business_management</code> and/or{' '}
                  <code className="text-amber-300">whatsapp_business_messaging</code>.
                  <br /><br />
                  Fix: Go to <strong className="text-white">Meta App Dashboard → WhatsApp → Embedded Signup → Edit configuration</strong> and add both scopes to the config. Then ask a test user to complete the Embedded Signup flow again so a new token is stored.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

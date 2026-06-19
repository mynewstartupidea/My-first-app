'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'
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

interface DebugInfo {
  whatsapp_accounts: {
    query_error:       { message: string; code: string } | null
    row_count:         number
    rows_with_token:   number
    fallback_reason:   string | null
    latest_row: {
      user_id:             string
      status:              string
      token_type:          string
      has_access_token:    boolean
      has_waba_id:         boolean
      has_phone_number_id: boolean
      has_business_id:     boolean
      display_phone:       string | null
      updated_at:          string | null
    } | null
    all_rows_summary: {
      user_id:          string
      status:           string
      has_access_token: boolean
      has_waba_id:      boolean
      updated_at:       string | null
    }[]
  }
  env_vars: {
    META_ACCESS_TOKEN_present:   boolean
    META_ACCESS_TOKEN_length:    number
    META_SYSTEM_USER_ID_present: boolean
    META_APP_ID_present:         boolean
  }
}

interface ApiResponse {
  token_source:    string
  fallback_reason: string | null
  granted_scopes:  string[]
  has_wba_mgmt:    boolean
  has_wa_msg:      boolean
  debug:           DebugInfo
  results:         StepResult[]
  summary:         { total: number; ok: number; failed: number }
  error?:          string
}

const REQUIRED_SCOPES = ['whatsapp_business_management', 'whatsapp_business_messaging']

function Field({ label, value, ok }: { label: string; value: string | boolean | number | null; ok?: boolean }) {
  const display = value === null ? 'null' : value === true ? 'yes' : value === false ? 'no' : String(value)
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-slate-400 text-xs font-mono flex-shrink-0">{label}</span>
      <span className={cn('text-xs font-mono font-semibold text-right', ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-slate-300')}>
        {display}
      </span>
    </div>
  )
}

export default function MetaReviewTestPage() {
  const [loading,  setLoading]  = useState(false)
  const [data,     setData]     = useState<ApiResponse | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setData(null)
    setError(null)
    setExpanded(null)
    try {
      const res  = await fetch('/api/admin/meta-review-test')
      const json = await res.json() as ApiResponse
      if (!res.ok && !json.debug) { setError(json.error ?? `HTTP ${res.status}`); return }
      setData(json)
      const firstFail = json.results?.findIndex(r => !r.ok) ?? -1
      if (firstFail >= 0) setExpanded(firstFail)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const wa = data?.debug?.whatsapp_accounts
  const ev = data?.debug?.env_vars

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-500 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div>
            <h1 className="text-white font-bold text-xl">Meta App Review — API Call Test</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Fires the exact 4 Graph API calls Meta needs to register for App Review.
            </p>
          </div>
        </div>

        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition mb-8">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
            : <><RefreshCw className="w-4 h-4" /> Run Meta Review Test</>}
        </button>

        {error && !data && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
            <p className="font-bold mb-1">Error</p><p>{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* ── DB Debug ────────────────────────────────────────────────── */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
              <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                {wa?.fallback_reason
                  ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                  : <CheckCircle2 className="w-4 h-4 text-green-400" />}
                whatsapp_accounts Table Debug
              </h2>

              {wa?.query_error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-300 font-mono">
                  Query error: {wa.query_error.message} (code: {wa.query_error.code})
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">Table</p>
                  <Field label="row_count"       value={wa?.row_count ?? 0}         ok={!!wa?.row_count && wa.row_count > 0} />
                  <Field label="rows_with_token" value={wa?.rows_with_token ?? 0}   ok={!!wa?.rows_with_token && wa.rows_with_token > 0} />
                </div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">Latest row</p>
                  {wa?.latest_row ? (
                    <>
                      <Field label="user_id"             value={wa.latest_row.user_id?.slice(0, 12) + '…'} />
                      <Field label="status"              value={wa.latest_row.status}             ok={wa.latest_row.status === 'connected'} />
                      <Field label="token_type"          value={wa.latest_row.token_type} />
                      <Field label="has_access_token"    value={wa.latest_row.has_access_token}   ok={wa.latest_row.has_access_token} />
                      <Field label="has_waba_id"         value={wa.latest_row.has_waba_id}        ok={wa.latest_row.has_waba_id} />
                      <Field label="has_phone_number_id" value={wa.latest_row.has_phone_number_id} ok={wa.latest_row.has_phone_number_id} />
                      <Field label="display_phone"       value={wa.latest_row.display_phone} />
                      <Field label="updated_at"          value={wa.latest_row.updated_at ? new Date(wa.latest_row.updated_at).toLocaleString() : null} />
                    </>
                  ) : (
                    <p className="text-red-400 text-xs font-mono">No rows found</p>
                  )}
                </div>
              </div>

              {wa?.fallback_reason && (
                <div className="mt-4 bg-amber-900/15 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 font-mono">
                  <p className="font-bold mb-1">Fallback reason:</p>
                  <p>{wa.fallback_reason}</p>
                </div>
              )}

              {(wa?.all_rows_summary?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">All rows</p>
                  <div className="space-y-1">
                    {wa!.all_rows_summary.map((r, i) => (
                      <div key={i} className="flex items-center gap-4 text-xs font-mono bg-black/20 rounded-lg px-3 py-1.5">
                        <span className="text-slate-500">{i + 1}.</span>
                        <span className="text-slate-300">{r.user_id?.slice(0, 12)}…</span>
                        <span className={r.has_access_token ? 'text-green-400' : 'text-red-400'}>token:{r.has_access_token ? 'yes' : 'no'}</span>
                        <span className={r.has_waba_id ? 'text-green-400' : 'text-red-400'}>waba:{r.has_waba_id ? 'yes' : 'no'}</span>
                        <span className="text-slate-500">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Env vars ────────────────────────────────────────────────── */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
              <h2 className="text-white font-bold text-sm mb-3">Env Vars</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ev && Object.entries(ev).map(([k, v]) => (
                  <div key={k} className={cn('rounded-xl p-3 border', v ? 'bg-green-900/20 border-green-500/20' : 'bg-red-900/20 border-red-500/20')}>
                    <p className="text-[10px] text-slate-400 mb-1 font-mono break-all">{k}</p>
                    <p className={cn('text-xs font-bold font-mono', v ? 'text-green-300' : 'text-red-300')}>
                      {typeof v === 'number' ? `${v} chars` : v ? 'present' : 'MISSING'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Token source ─────────────────────────────────────────────── */}
            <div className={cn('border rounded-xl p-3 mb-6 text-xs font-mono', data.fallback_reason ? 'bg-amber-900/10 border-amber-500/20 text-amber-300' : 'bg-green-900/10 border-green-500/20 text-green-300')}>
              <span className="text-slate-400">Token source: </span>{data.token_source}
            </div>

            {/* ── API call results ─────────────────────────────────────────── */}
            {(data.results?.length ?? 0) > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Calls passed',                   value: `${data.summary.ok} / ${data.summary.total}`,   ok: data.summary.failed === 0 },
                    { label: 'whatsapp_business_management',   value: data.has_wba_mgmt ? '✓ Granted' : '✗ Missing', ok: data.has_wba_mgmt },
                    { label: 'whatsapp_business_messaging',    value: data.has_wa_msg   ? '✓ Granted' : '✗ Missing', ok: data.has_wa_msg },
                    { label: 'Granted scopes total',           value: String(data.granted_scopes.length),             ok: data.granted_scopes.length > 0 },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className={cn('rounded-xl p-3 border', ok ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30')}>
                      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                      <p className={cn('text-sm font-bold font-mono', ok ? 'text-green-300' : 'text-red-300')}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {data.results.map((r, i) => (
                    <div key={i} className={cn('border rounded-xl overflow-hidden', r.ok ? 'border-green-500/20' : 'border-red-500/30')}>
                      <button onClick={() => setExpanded(expanded === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition">
                        <div className="flex items-center gap-3">
                          {r.ok ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                          <div>
                            <p className="text-sm text-white font-medium">{r.step}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{r.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded font-mono', r.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300')}>
                            {r.status ?? 'ERR'}
                          </span>
                          <span className="text-slate-600 text-xs">{r.durationMs}ms</span>
                          {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </button>
                      {expanded === i && (
                        <div className="border-t border-white/8 bg-black/30 p-4">
                          {r.error && <p className="text-red-400 text-xs mb-3 font-mono">{r.error}</p>}
                          <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                            {JSON.stringify(r.body, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

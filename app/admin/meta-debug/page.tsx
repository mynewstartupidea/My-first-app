'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Search, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface StepResult { url: string; http: number | null; ok: boolean; raw: string; parsed: unknown; ms: number }
interface Result {
  diagnosis: string
  config: Record<string, string | boolean>
  scopes: {
    granted:   string[]
    declined:  string[]
    missing:   string[]
    has_business_management:          boolean
    has_whatsapp_business_management: boolean
    has_whatsapp_business_messaging:  boolean
  }
  steps: {
    '1_me':          StepResult
    '2_permissions': StepResult
    '3_businesses':  StepResult
    '4_waba':        Record<string, StepResult>
  }
  error?: string
}

const REQUIRED = ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging']

function RawBlock({ label, step }: { label: string; step: StepResult }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('border rounded-xl overflow-hidden', step.ok ? 'border-green-500/20' : 'border-red-500/30')}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition text-left">
        <div className="flex items-center gap-3">
          {step.ok ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
          <div>
            <p className="text-sm text-white font-medium">{label}</p>
            <p className="text-xs text-slate-500 font-mono">{step.url}</p>
          </div>
        </div>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded font-mono ml-4', step.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300')}>
          HTTP {step.http ?? 'ERR'} · {step.ms}ms
        </span>
      </button>
      {open && (
        <div className="border-t border-white/8 bg-black/30 p-4">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Full raw response</p>
          <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(step.parsed, null, 2) || step.raw}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function MetaDebugPage() {
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<Result | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  async function run() {
    if (!token.trim()) return
    setLoading(true); setResult(null); setErr(null)
    try {
      const res  = await fetch(`/api/admin/meta-debug?token=${encodeURIComponent(token.trim())}`)
      const data = await res.json() as Result
      if (data.error && !data.scopes) { setErr(data.error); return }
      setResult(data)
    } catch (e) { setErr(String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-500 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div>
            <h1 className="text-white font-bold text-xl">Meta Token Debug</h1>
            <p className="text-slate-500 text-xs mt-0.5">Paste any Meta access token — see raw permissions + businesses response</p>
          </div>
        </div>

        {/* Token input */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
          <p className="text-slate-400 text-xs mb-1">
            Get a token from <span className="text-white font-mono">Meta Graph API Explorer</span> (select your app, add all 3 scopes, generate token) or from Vercel function logs after an Embedded Signup attempt.
          </p>
          <p className="text-slate-500 text-[10px] mb-3">Scopes to add in Explorer: business_management · whatsapp_business_management · whatsapp_business_messaging</p>
          <div className="flex gap-3">
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="EAAxxxxxxx…"
              className="flex-1 bg-black/30 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder:text-slate-600"
            />
            <button onClick={run} disabled={loading || !token.trim()}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Run
            </button>
          </div>
        </div>

        {err && <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">{err}</div>}

        {result && (
          <>
            {/* Diagnosis */}
            <div className={cn('rounded-2xl p-5 mb-6 border', result.scopes.missing.length === 0 && result.steps['3_businesses'].ok ? 'bg-green-900/10 border-green-500/20' : 'bg-amber-900/10 border-amber-500/20')}>
              <div className="flex items-start gap-3">
                {result.scopes.missing.length === 0 && result.steps['3_businesses'].ok
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold text-white mb-1">Diagnosis</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{result.diagnosis}</p>
                </div>
              </div>
            </div>

            {/* Config */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">App Config (server env)</p>
              <div className="space-y-1.5">
                {Object.entries(result.config).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-mono">{k}</span>
                    <span className={cn('text-xs font-mono font-semibold', v === '(NOT SET)' || v === false ? 'text-red-400' : 'text-green-400')}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scopes */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Scopes on this token</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {result.scopes.granted.map(s => (
                  <span key={s} className={cn('text-xs px-2.5 py-1 rounded-full font-medium font-mono', REQUIRED.includes(s) ? 'bg-green-900/40 text-green-300 border border-green-500/30' : 'bg-white/5 text-slate-400')}>
                    ✓ {s}
                  </span>
                ))}
                {result.scopes.declined.map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full font-medium font-mono bg-red-900/40 text-red-300 border border-red-500/30">
                    ✗ {s}
                  </span>
                ))}
              </div>
              {result.scopes.missing.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 font-mono">
                  MISSING (required): {result.scopes.missing.join(', ')}
                </div>
              )}
            </div>

            {/* Raw steps */}
            <div className="space-y-3">
              <RawBlock label="GET /me"                     step={result.steps['1_me']} />
              <RawBlock label="GET /me/permissions"         step={result.steps['2_permissions']} />
              <RawBlock label="GET /me/businesses"          step={result.steps['3_businesses']} />
              {Object.entries(result.steps['4_waba']).map(([bizLabel, step]) => (
                <RawBlock key={bizLabel} label={`GET /${bizLabel}/whatsapp_business_accounts`} step={step as StepResult} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

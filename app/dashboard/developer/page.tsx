'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Code2, Key, Webhook, Copy, Eye, EyeOff, CheckCircle2,
  RefreshCw, Loader2, AlertCircle, Globe, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://wapaci.com'

const OUTBOUND_EVENTS = [
  { event: 'message.sent',      desc: 'Fired when a WhatsApp message is sent to a lead' },
  { event: 'message.delivered', desc: 'Fired when message is delivered to the phone' },
  { event: 'message.read',      desc: 'Fired when the lead reads the message' },
]

export default function DeveloperPage() {
  const [apiKey,      setApiKey]      = useState('')
  const [showKey,     setShowKey]     = useState(false)
  const [copied,      setCopied]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [rotating,    setRotating]    = useState(false)
  const [showCurl,    setShowCurl]    = useState(false)
  const [showHtml,    setShowHtml]    = useState(false)
  const [showJs,      setShowJs]      = useState(false)
  const [showGhlSteps, setShowGhlSteps] = useState(false)

  const loadKey = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/developer/key')
    const d = await r.json() as { api_key?: string }
    if (d.api_key) setApiKey(d.api_key)
    setLoading(false)
  }, [])

  useEffect(() => { loadKey() }, [loadKey])

  async function rotateKey() {
    if (!confirm('Rotate your API key? Any landing pages using the old key will stop working until updated.')) return
    setRotating(true)
    const r = await fetch('/api/developer/key', { method: 'POST' })
    const d = await r.json() as { api_key?: string }
    if (d.api_key) { setApiKey(d.api_key); setShowKey(true) }
    setRotating(false)
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const maskedKey = apiKey ? `wap_live_${'•'.repeat(24)}` : '—'
  const ingestUrl = `${BASE_URL}/api/leads/ingest`
  const ghlUrl    = `${BASE_URL}/api/leads/ghl?key=${apiKey || 'YOUR_API_KEY'}`

  const curlSnippet = `curl -X POST "${ingestUrl}" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "+919876543210",
    "email": "rahul@example.com",
    "source": "Landing Page",
    "budget": "50L",
    "city": "Mumbai"
  }'`

  const htmlSnippet = `<form id="lead-form">
  <input name="name"  placeholder="Your name"  required />
  <input name="phone" placeholder="Phone"       required />
  <input name="email" placeholder="Email" />
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(e.target))
  data.source = 'Landing Page'   // matches your form automation name

  await fetch('${ingestUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey || 'YOUR_API_KEY'}'
    },
    body: JSON.stringify(data)
  })
  // redirect or show thank-you message
})
</script>`

  const jsSnippet = `// Node.js / server-side example
const res = await fetch('${ingestUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey || 'YOUR_API_KEY'}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name:   'Priya Patel',
    phone:  '+919123456789',
    email:  'priya@example.com',
    source: 'Landing Page',
    // any extra fields from your form:
    budget: '1Cr',
    bhk:    '3BHK',
  }),
})
const { success, lead_id } = await res.json()
`

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Code2 size={22} className="text-slate-700" /> Developer
        </h1>
        <p className="text-slate-500 text-sm mt-1">Connect your landing pages and custom forms to Wapaci</p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Key size={15} className="text-slate-600" /> API Key
        </h2>
        <p className="text-slate-500 text-xs mb-4">
          Use this key to authenticate lead submissions from your landing page. Keep it secret — never paste it in client-side code that users can inspect.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
            <Loader2 size={14} className="animate-spin" /> Loading key…
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-3">
              <code className="flex-1 text-xs font-mono text-green-400 truncate">
                {showKey ? apiKey : maskedKey}
              </code>
              <button onClick={() => setShowKey(v => !v)} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => copy(apiKey, 'apikey')} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
                {copied === 'apikey' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={rotateKey}
                disabled={rotating}
                className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                {rotating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Rotate Key
              </button>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                <AlertCircle size={11} /> Send from your server, not browser JS
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lead Ingest Endpoint */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Globe size={15} className="text-slate-600" /> Lead Ingest Endpoint
        </h2>
        <p className="text-slate-500 text-xs mb-4">
          POST lead data here from any landing page, form builder, or custom code.
          Leads appear instantly in your Leads dashboard and trigger WhatsApp automation if you have one set up.
        </p>

        {/* Endpoint URL */}
        <div className="rounded-xl bg-slate-50 p-3.5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 rounded-md font-mono bg-emerald-100 text-emerald-700">POST</span>
              <p className="text-xs font-semibold text-slate-700">Ingest a lead</p>
            </div>
            <button onClick={() => copy(ingestUrl, 'ingest')}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition">
              {copied === 'ingest' ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
              {copied === 'ingest' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code className="text-xs font-mono text-blue-600 break-all">{ingestUrl}</code>
        </div>

        {/* Request fields */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-700 mb-2">Request body (JSON)</p>
          <div className="space-y-1.5">
            {[
              { field: 'name',   type: 'string', req: false, desc: 'Full name of the lead' },
              { field: 'phone',  type: 'string', req: false, desc: 'Phone number — Indian numbers auto-normalized to E.164' },
              { field: 'email',  type: 'string', req: false, desc: 'Email address' },
              { field: 'source', type: 'string', req: false, desc: 'Label shown in dashboard, e.g. "Landing Page" or "Google Ad"' },
              { field: '…',      type: 'string', req: false, desc: 'Any extra fields (budget, city, bhk…) are saved and usable in message templates' },
            ].map(r => (
              <div key={r.field} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-50 last:border-0">
                <code className="font-mono text-violet-600 w-16 flex-shrink-0">{r.field}</code>
                <code className="font-mono text-slate-400 w-12 flex-shrink-0">{r.type}</code>
                <span className="text-slate-500 flex-1">{r.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">At least one of <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">phone</code>, or <code className="bg-slate-100 px-1 rounded">email</code> is required.</p>
        </div>

        {/* WhatsApp automation note */}
        <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 mb-5">
          <p className="font-semibold mb-0.5">Auto-WhatsApp for landing page leads</p>
          <p>In the Leads page → <strong>All forms</strong>, create a form automation named exactly <code className="bg-green-100 px-1 rounded">Landing Page</code> (or match your <code className="bg-green-100 px-1 rounded">source</code> value). New inbound leads will trigger that template automatically.</p>
        </div>

        {/* Code snippets */}
        <div className="space-y-3">
          {/* cURL */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCurl(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2"><code className="text-xs font-mono text-slate-500">cURL</code> example</span>
              {showCurl ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showCurl && (
              <div className="relative">
                <pre className="bg-slate-900 text-green-400 text-[11px] font-mono p-4 overflow-x-auto leading-relaxed">{curlSnippet}</pre>
                <button onClick={() => copy(curlSnippet, 'curl')}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition">
                  {copied === 'curl' ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copied === 'curl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* HTML form */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHtml(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2"><code className="text-xs font-mono text-slate-500">HTML form</code> — paste on any landing page</span>
              {showHtml ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHtml && (
              <div className="relative">
                <pre className="bg-slate-900 text-green-400 text-[11px] font-mono p-4 overflow-x-auto leading-relaxed">{htmlSnippet}</pre>
                <button onClick={() => copy(htmlSnippet, 'html')}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition">
                  {copied === 'html' ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copied === 'html' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* JS / Node */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowJs(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2"><code className="text-xs font-mono text-slate-500">JavaScript / Node.js</code></span>
              {showJs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showJs && (
              <div className="relative">
                <pre className="bg-slate-900 text-green-400 text-[11px] font-mono p-4 overflow-x-auto leading-relaxed">{jsSnippet}</pre>
                <button onClick={() => copy(jsSnippet, 'js')}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition">
                  {copied === 'js' ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copied === 'js' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Go High Level */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Zap size={15} className="text-orange-500" /> Go High Level
        </h2>
        <p className="text-slate-500 text-xs mb-4">
          Connect any GHL funnel or landing page — no Zapier needed. GHL sends a webhook when a form is submitted; we parse their format automatically.
        </p>

        {/* GHL webhook URL */}
        <div className="rounded-xl bg-slate-50 p-3.5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 rounded-md font-mono bg-emerald-100 text-emerald-700">POST</span>
              <p className="text-xs font-semibold text-slate-700">GHL Webhook URL</p>
            </div>
            <button onClick={() => copy(ghlUrl, 'ghl')}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition">
              {copied === 'ghl' ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
              {copied === 'ghl' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code className="text-xs font-mono text-blue-600 break-all">{ghlUrl}</code>
          <p className="text-[10px] text-slate-400 mt-1">Your API key is embedded in the URL — GHL sends it back automatically on every submission</p>
        </div>

        {/* What gets mapped */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">What gets mapped from GHL</p>
          <div className="space-y-1">
            {[
              { ghl: 'firstName + lastName', wapaci: 'name' },
              { ghl: 'phone',               wapaci: 'phone (auto-normalized)' },
              { ghl: 'email',               wapaci: 'email' },
              { ghl: 'customFields[]',      wapaci: 'extra fields — usable as {{variable}} in templates' },
              { ghl: 'form.name',           wapaci: 'source label shown in dashboard' },
            ].map(r => (
              <div key={r.ghl} className="flex items-center gap-3 text-xs py-1 border-b border-slate-50 last:border-0">
                <code className="font-mono text-slate-500 w-36 flex-shrink-0">{r.ghl}</code>
                <span className="text-slate-300">→</span>
                <span className="text-slate-600">{r.wapaci}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step by step */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowGhlSteps(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
          >
            <span>Step-by-step GHL setup</span>
            {showGhlSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showGhlSteps && (
            <div className="p-4 space-y-3">
              {[
                { n: 1, title: 'Copy your webhook URL above', body: 'Click the Copy button — your API key is already embedded in it.' },
                { n: 2, title: 'Open GHL → Automations → Workflows', body: 'Create a new workflow or open an existing one.' },
                { n: 3, title: 'Add trigger: Form Submitted', body: 'Select the funnel and form you want to capture leads from.' },
                { n: 4, title: 'Add action: Webhook', body: 'Choose "Send HTTP Request". Set method to POST, paste the URL. Leave body as-is — GHL auto-sends the contact payload.' },
                { n: 5, title: 'Publish the workflow', body: 'Turn it on. The next form submission will create a lead in Wapaci instantly.' },
                { n: 6, title: '(Optional) Set up WhatsApp automation', body: 'In Leads → All forms, create a form automation named exactly matching your GHL form name (or "GHL Form"). New leads will be messaged automatically.' },
              ].map(s => (
                <div key={s.n} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outbound Webhooks */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Webhook size={15} className="text-slate-600" /> Platform Webhook URLs
        </h2>
        <p className="text-slate-500 text-xs mb-4">Register these in the respective platforms</p>
        <div className="space-y-3 mb-5">
          {[
            { label: 'Meta WhatsApp', url: `${BASE_URL}/api/meta/webhook`, note: 'messages, message_deliveries, message_reads' },
            { label: 'Facebook Lead Ads', url: `${BASE_URL}/api/facebook/webhook`, note: 'leadgen — new leads from Lead Ad forms' },
          ].map(w => (
            <div key={w.label} className="rounded-xl bg-slate-50 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-700">{w.label}</p>
                <button onClick={() => copy(w.url, w.label)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition">
                  {copied === w.label ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied === w.label ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="text-xs font-mono text-blue-600 break-all">{w.url}</code>
              <p className="text-[10px] text-slate-400 mt-1">{w.note}</p>
            </div>
          ))}
        </div>

        {/* Outbound events reference */}
        <p className="text-xs font-semibold text-slate-700 mb-2">Outbound event types</p>
        <div className="space-y-2">
          {OUTBOUND_EVENTS.map(w => (
            <div key={w.event} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <code className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded flex-shrink-0">{w.event}</code>
              <p className="text-xs text-slate-500">{w.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

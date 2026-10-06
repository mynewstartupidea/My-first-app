'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Info, MessageCircle, ShieldAlert } from 'lucide-react'

const PLACEHOLDER = `Tell the AI about your business — the more specific, the better its replies will be. For example:

Services & pricing:
- Haircut ₹300, Hair color ₹1200, Facial ₹800

Hours:
- Open Mon–Sat, 10am–8pm. Closed Sundays.

Location:
- 12 MG Road, Bengaluru. Free parking available.

Policies:
- Free cancellation up to 2 hours before appointment.

Common questions:
- Q: Do you take walk-ins? A: Yes, but appointments are preferred to avoid waiting.`

function AIAssistantInner() {
  const searchParams = useSearchParams()
  const needsInfo = searchParams.get('needsInfo') === '1'

  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [content, setContent]   = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [enabled, setEnabled]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toggling, setToggling] = useState(false)
  const [savedAt, setSavedAt]   = useState<number | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/ai/knowledge-base')
      .then(async r => {
        if (r.status === 403) { setForbidden(true); setLoading(false); return }
        if (!r.ok) {
          const d = await r.json().catch(() => ({})) as { error?: string }
          setLoadError(d.error ?? 'Could not load the AI Assistant settings.')
          setLoading(false)
          return
        }
        const d = await r.json() as { content: string; enabled: boolean }
        setContent(d.content)
        setSavedContent(d.content)
        setEnabled(d.enabled)
        setLoading(false)
        if (needsInfo) setTimeout(() => textareaRef.current?.focus(), 100)
      })
      .catch(() => { setLoadError('Could not load the AI Assistant settings.'); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = content !== savedContent

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const res = await fetch('/api/ai/knowledge-base', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      setSavedContent(content)
      setSavedAt(Date.now())
      setToggleError(null)
    } else {
      // Previously did nothing on failure — the button just stopped
      // spinning and silently reverted to "Unsaved changes" with no
      // indication the knowledge base the AI uses to reply to customers
      // was never actually saved.
      const d = await res.json().catch(() => ({})) as { error?: string }
      setSaveError(d.error ?? "Couldn't save your knowledge base. Please try again.")
    }
    setSaving(false)
  }

  async function handleToggle() {
    setToggling(true)
    setToggleError(null)
    const next = !enabled
    const res = await fetch('/api/ai/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    const data = await res.json().catch(() => ({})) as { enabled?: boolean; error?: string; message?: string }
    if (res.ok) {
      setEnabled(data.enabled ?? next)
    } else if (data.error === 'needs_knowledge_base') {
      setToggleError(data.message ?? 'Please fill in some information about your business first.')
      textareaRef.current?.focus()
    } else {
      // Previously fell through with no feedback at all for any other
      // failure (expired session, no store connected, a save error) — the
      // switch just silently stayed put with nothing telling the user why.
      setToggleError(data.message ?? data.error ?? "Couldn't update this setting. Please try again.")
    }
    setToggling(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
        <div className="flex flex-col items-center text-center gap-3 py-16 px-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Admins only</p>
          <p className="text-xs text-gray-400 max-w-sm">
            The AI Assistant controls what AI says to customers automatically, so only the account owner or an admin can view or change it.
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
        <div className="flex flex-col items-center text-center gap-3 py-16 px-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Couldn&apos;t load AI Assistant</p>
          <p className="text-xs text-gray-400 max-w-sm">{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl space-y-5">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#25D366]" />
          AI Assistant
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Let AI reply to WhatsApp messages automatically, using what you tell it about your business.
        </p>
      </div>

      {needsInfo && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Please fill in some information about your business below — the AI needs this before it can reply for you.
          </p>
        </div>
      )}

      {/* On/off status card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-[#25D366]/10' : 'bg-gray-100'}`}>
              <MessageCircle className={`w-5 h-5 ${enabled ? 'text-[#25D366]' : 'text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                WhatsApp AI auto-reply is {enabled ? 'on' : 'off'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {enabled
                  ? 'New WhatsApp messages get an instant AI reply based on your knowledge base below. You can still jump into any conversation yourself in Live Chat.'
                  : 'Turn this on to have AI reply instantly to new WhatsApp messages using the information you provide below.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={toggling}
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle AI auto-reply"
            className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-colors disabled:opacity-60 ring-1 ring-inset ${
              enabled ? 'bg-[#25D366] ring-[#1aad54]' : 'bg-gray-200 ring-gray-300'
            }`}
          >
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {toggleError && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{toggleError}</p>
          </div>
        )}
      </div>

      {/* Knowledge base editor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Knowledge base</p>
            <p className="text-xs text-gray-400 mt-0.5">The AI only answers using what's written here — nothing is invented.</p>
          </div>
          <span className="text-xs text-gray-300 tabular-nums flex-shrink-0">{content.length.toLocaleString()} chars</span>
        </div>

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={16}
            className="w-full text-base leading-relaxed text-gray-800 placeholder:text-gray-300 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-y"
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">
              {savedAt && !dirty ? (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              ) : dirty ? (
                'Unsaved changes'
              ) : (
                'Add details, then save'
              )}
            </p>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition active:scale-[0.97]"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {saveError && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{saveError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5">
        <p className="text-sm font-semibold text-blue-900 mb-2">What to include</p>
        <ul className="text-xs text-blue-800 space-y-1.5 leading-relaxed">
          <li>• Your services or products and their prices</li>
          <li>• Business hours and location</li>
          <li>• Policies — cancellations, refunds, delivery, warranty</li>
          <li>• Answers to questions customers ask most often</li>
        </ul>
      </div>

    </div>
  )
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    }>
      <AIAssistantInner />
    </Suspense>
  )
}

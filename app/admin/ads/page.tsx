'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles, Play, Download, TrendingUp, Target, BarChart3,
  Mic, Loader2, Volume2, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, ArrowLeft, X, Film, RefreshCw
} from 'lucide-react'

/* ─── Ad definitions ──────────────────────────────────────────────── */
const ADS = [
  {
    id: 1,
    file: '/ads/ad1.html',
    filename: 'wapaci-cart-recovery',
    title: 'Cart Recovery — PAS Formula',
    tag: 'Cold Traffic',
    tagColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
    audience: 'Meta cold / lookalike',
    accent: '#ef4444',
    gradient: 'from-red-950 to-[#0a0f1a]',
    // Muga model: tone tags + pauses for maximum expressiveness
    mugaScript: `[serious] Right now... seventy percent of your customers... are leaving without buying.

[emotional] That's real revenue. Walking out the door. Every. Single. Day.

[conversational] And you have no way to bring them back. No second chance.

[serious] Until now.

[excited] Wapaci sends them a WhatsApp message — automatically. In plain Hindi or English. At exactly the right moment.

[happy] And they come back.

[excited] Twenty-eight percent of abandoned carts recovered. On autopilot. Every month.

[serious] Your competitors are already doing this.

[conversational] Try Wapaci free. Start recovering revenue today.`,
    // Mulberry model: natural language voice direction
    mulberryDescription: 'Indian male voice, radio commercial tone, dramatic and serious for the opening, build urgency slowly, pause meaningfully between short sentences, rise to excitement when revealing the solution, warm and trustworthy close',
  },
  {
    id: 2,
    file: '/ads/ad2.html',
    filename: 'wapaci-roi-machine',
    title: 'ROI Machine — Outcome First',
    tag: 'Warm Traffic',
    tagColor: 'bg-green-500/20 text-green-400 border border-green-500/30',
    audience: 'Retargeting / email list',
    accent: '#25D366',
    gradient: 'from-green-950 to-[#060d06]',
    mugaScript: `[excited] What if I told you... five lakh rupees of abandoned carts... could become one point four lakh in recovered revenue?

[serious] That's not a promise. That's the math.

[conversational] WhatsApp messages get a ninety-eight percent open rate.

[serious] Ninety. Eight. Percent.

[conversational] Read in under three minutes. Forty-five percent of customers actually reply.

[excited] That's forty-seven times your investment. Every. Single. Month.

[emotional] The math is simple. The setup takes ten minutes.

[happy] The results... speak for themselves.

[excited] Start your free trial at wapaci dot com today.`,
    mulberryDescription: 'Confident Indian male voice, start with genuine surprise and excitement, slow down dramatically on the numbers to let them land, conversational and warm in the middle section, build back to high energy at the close, like a passionate entrepreneur sharing a discovery',
  },
  {
    id: 3,
    file: '/ads/ad3.html',
    filename: 'wapaci-channel-wars',
    title: 'Channel Wars — Comparison',
    tag: 'Consideration',
    tagColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    audience: 'Brand aware / consideration',
    accent: '#3b82f6',
    gradient: 'from-blue-950 to-[#0a0a14]',
    mugaScript: `[serious] Quick question.

[conversational] Which channel do your customers actually read?

[serious] Email?

[emotional] Two percent open rate.

[serious] SMS?

[emotional] Five percent.

[excited] WhatsApp?

[excited] Ninety. Eight. Percent.

[serious] Think about that for a second.

[conversational] Your customers are on WhatsApp. They read messages in under three minutes. Almost half of them reply.

[emotional] Stop sending emails nobody opens.

[excited] Start sending WhatsApp messages that actually convert.

[happy] Wapaci — WhatsApp automation for D2C brands. Try it free today.`,
    mulberryDescription: 'Indian male voice with dramatic pauses, start slow and serious like asking a rhetorical question, let silence hang between the stats, deliver each number with deliberate weight, build intensity with each comparison, peak excitement on the WhatsApp stat, then confident and warm for the close',
  },
]

const VOICE_STYLES = [
  { label: 'Energetic Male', value: 'energetic confident Indian male voice, upbeat and fast-paced, radio presenter style' },
  { label: 'Warm & Trustworthy', value: 'warm deep trustworthy Indian male voice, calm and reassuring, like a mentor' },
  { label: 'Professional Female', value: 'clear confident Indian female voice, professional and authoritative, sharp delivery' },
  { label: 'Conversational Male', value: 'casual friendly Indian male voice, like talking to a friend, natural and relaxed' },
]

type VoiceoverState = {
  script: string
  model: 'mulberry' | 'muga'
  styleDesc: string
  status: 'idle' | 'generating' | 'ready' | 'error'
  audioUrl: string | null
  error: string | null
}

type RecordingState = {
  active: boolean
  adId: number | null
  phase: 'starting' | 'recording' | 'processing' | null
  secondsLeft: number
}

export default function AdminAdsPage() {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [voiceovers, setVoiceovers] = useState<Record<number, VoiceoverState>>(
    Object.fromEntries(ADS.map(ad => [ad.id, {
      script: ad.mugaScript,
      model: 'muga' as const,
      styleDesc: VOICE_STYLES[0].value,
      status: 'idle' as const,
      audioUrl: null,
      error: null,
    }]))
  )
  const [recording, setRecording] = useState<RecordingState>({
    active: false, adId: null, phase: null, secondsLeft: 32,
  })

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  function setVo(id: number, patch: Partial<VoiceoverState>) {
    setVoiceovers(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  /* ── Generate voiceover ── */
  async function generate(ad: typeof ADS[0]) {
    const v = voiceovers[ad.id]
    setVo(ad.id, { status: 'generating', error: null, audioUrl: null })
    try {
      const body: Record<string, string> = { text: v.script, model: v.model }
      if (v.model === 'mulberry') body.description = ad.mulberryDescription + ', ' + v.styleDesc
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Generation failed')
      }
      const blob = await res.blob()
      setVo(ad.id, { status: 'ready', audioUrl: URL.createObjectURL(blob) })
    } catch (e: unknown) {
      setVo(ad.id, { status: 'error', error: e instanceof Error ? e.message : 'Error' })
    }
  }

  /* ── Download MP4 (in-page recording) ── */
  const downloadMp4 = useCallback(async (ad: typeof ADS[0]) => {
    const v = voiceovers[ad.id]

    // Store voiceover in sessionStorage so the iframe picks it up
    if (v.audioUrl) {
      const buf = await fetch(v.audioUrl).then(r => r.arrayBuffer())
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      sessionStorage.setItem(`wapaci_voiceover_${ad.id}`, b64)
    } else {
      sessionStorage.removeItem(`wapaci_voiceover_${ad.id}`)
    }

    setRecording({ active: true, adId: ad.id, phase: 'starting', secondsLeft: 32 })

    // Small delay to let the iframe overlay render first
    await new Promise(r => setTimeout(r, 600))

    const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 } as MediaTrackConstraints,
        audio: true,
        // @ts-expect-error: Chrome-only
        preferCurrentTab: true,
      })
    } catch {
      setRecording({ active: false, adId: null, phase: null, secondsLeft: 32 })
      return
    }

    chunksRef.current = []
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    recorderRef.current = rec

    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      setRecording({ active: false, adId: null, phase: 'processing', secondsLeft: 0 })
      const blob = new Blob(chunksRef.current, { type: mime })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${ad.filename}.${mime.includes('mp4') ? 'mp4' : 'webm'}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => { URL.revokeObjectURL(url); setRecording(r => ({ ...r, phase: null })) }, 3000)
      sessionStorage.removeItem(`wapaci_voiceover_${ad.id}`)
    }

    rec.start(100)
    setRecording({ active: true, adId: ad.id, phase: 'recording', secondsLeft: 32 })

    let secs = 32
    timerRef.current = setInterval(() => {
      secs--
      setRecording(r => ({ ...r, secondsLeft: secs }))
      if (secs <= 0) { clearInterval(timerRef.current!); rec.stop() }
    }, 1000)
  }, [voiceovers])

  function cancelRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording({ active: false, adId: null, phase: null, secondsLeft: 32 })
  }

  // cleanup
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const recordingAd = ADS.find(a => a.id === recording.adId)

  return (
    <div className="min-h-screen bg-[#070b12] text-white">

      {/* ── Fullscreen recording overlay ── */}
      {recording.active && recordingAd && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3 bg-black/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {recording.phase === 'starting' ? (
                <><Loader2 size={16} className="animate-spin text-yellow-400" /><span className="text-yellow-400 text-sm font-semibold">Starting — select this tab in the share dialog…</span></>
              ) : (
                <><div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400 text-sm font-bold">REC {recording.secondsLeft}s remaining</span></>
              )}
            </div>
            <button onClick={cancelRecording} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 transition">
              <X size={12} /> Cancel
            </button>
          </div>
          {/* Ad iframe fills screen */}
          <iframe
            src={`${recordingAd.file}?autostart=1`}
            className="flex-1 w-full border-0"
            allow="autoplay"
            title={recordingAd.title}
          />
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b border-white/[0.06] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm transition">
            <ArrowLeft size={14} /> Admin
          </a>
          <span className="text-slate-700">›</span>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <Film size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Ad Engine</h1>
              <p className="text-slate-500 text-xs mt-0.5">1080×1080 · AI voiceover · MP4 download</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
          Powered by Rumik Silk
        </div>
      </div>

      {/* ── Strategy pills ── */}
      <div className="px-8 py-4 flex items-center gap-3 border-b border-white/[0.04]">
        {[
          { icon: Target, label: 'Cold Traffic · PAS', color: 'text-red-400' },
          { icon: TrendingUp, label: 'Warm Traffic · ROI-First', color: 'text-green-400' },
          { icon: BarChart3, label: 'Consideration · Comparison', color: 'text-blue-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-1.5">
            <Icon size={13} className={color} />
            <span className="text-slate-300 text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Ad cards ── */}
      <div className="px-8 py-6 space-y-5">
        {ADS.map(ad => {
          const v = voiceovers[ad.id]
          const isExp = expanded === ad.id

          return (
            <div key={ad.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">

              {/* Card row */}
              <div className="flex gap-0">
                {/* Thumbnail */}
                <div className={`relative w-48 flex-shrink-0 bg-gradient-to-b ${ad.gradient} flex items-center justify-center`}>
                  <div className="w-24 h-24 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 shadow-xl">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ad.accent + '25' }}>
                      <Play size={14} style={{ color: ad.accent }} fill={ad.accent} />
                    </div>
                    <div className="w-10 h-1 rounded-full" style={{ backgroundColor: ad.accent + '60' }} />
                    <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: ad.accent + '30' }} />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ad.tagColor}`}>{ad.tag}</span>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <span className="text-[9px] text-slate-600 font-bold">1080×1080</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-white font-bold text-base">{ad.title}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{ad.audience}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    {/* Preview */}
                    <button
                      onClick={() => window.open(ad.file, '_blank')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-sm font-semibold transition"
                    >
                      <Play size={12} fill="currentColor" /> Preview
                    </button>

                    {/* Download MP4 */}
                    <button
                      onClick={() => downloadMp4(ad)}
                      disabled={recording.active}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: ad.accent + '20', color: ad.accent, border: `1px solid ${ad.accent}40` }}
                    >
                      <Download size={12} /> Download MP4
                    </button>

                    {/* Voiceover toggle */}
                    <button
                      onClick={() => setExpanded(isExp ? null : ad.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition ml-auto ${
                        v.status === 'ready'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic size={12} />
                      {v.status === 'ready' ? 'Voiceover ✓' : 'Add Voiceover'}
                      {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Voiceover panel ── */}
              {isExp && (
                <div className="border-t border-white/[0.06] bg-black/20 p-5">
                  <div className="grid grid-cols-5 gap-5">

                    {/* Script editor — 3 cols */}
                    <div className="col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Script</label>
                        <button
                          onClick={() => setVo(ad.id, { script: v.model === 'muga' ? ad.mugaScript : ad.mugaScript })}
                          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
                        >
                          <RefreshCw size={10} /> Reset to default
                        </button>
                      </div>
                      <textarea
                        rows={10}
                        value={v.script}
                        onChange={e => setVo(ad.id, { script: e.target.value })}
                        className="w-full text-sm text-slate-200 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 font-mono leading-relaxed transition placeholder-slate-600"
                        placeholder="Write your voiceover script…"
                      />
                      <p className="text-slate-600 text-[10px] mt-1.5">
                        Muga: use <code className="text-purple-400">[happy]</code> <code className="text-purple-400">[excited]</code> <code className="text-purple-400">[serious]</code> <code className="text-purple-400">[emotional]</code> tone tags &amp; <code className="text-purple-400">...</code> for pauses
                      </p>
                    </div>

                    {/* Controls — 2 cols */}
                    <div className="col-span-2 space-y-4">
                      {/* Model */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Model</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['muga', 'mulberry'] as const).map(m => (
                            <button key={m} onClick={() => setVo(ad.id, { model: m })}
                              className={`py-2 rounded-lg text-xs font-bold border transition capitalize ${
                                v.model === m
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-purple-500/40'
                              }`}>{m}</button>
                          ))}
                        </div>
                        <p className="text-slate-600 text-[10px] mt-1.5">
                          {v.model === 'muga' ? 'Expressive · tone tags · raw emotion' : 'Faster · natural language description'}
                        </p>
                      </div>

                      {/* Voice style (mulberry only) */}
                      {v.model === 'mulberry' && (
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Voice Style</label>
                          <select
                            value={v.styleDesc}
                            onChange={e => setVo(ad.id, { styleDesc: e.target.value })}
                            className="w-full text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          >
                            {VOICE_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Generate button */}
                      <button
                        onClick={() => generate(ad)}
                        disabled={v.status === 'generating' || !v.script.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition"
                      >
                        {v.status === 'generating'
                          ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                          : <><Sparkles size={14} /> Generate Voiceover</>}
                      </button>

                      {/* Error */}
                      {v.status === 'error' && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-red-400 text-xs">{v.error}</p>
                        </div>
                      )}

                      {/* Audio preview */}
                      {v.status === 'ready' && v.audioUrl && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Volume2 size={13} className="text-purple-400" />
                            <span className="text-purple-300 text-xs font-semibold">Preview voiceover</span>
                            <CheckCircle2 size={12} className="text-purple-400 ml-auto" />
                          </div>
                          <audio src={v.audioUrl} controls className="w-full" style={{ height: '32px' }} />
                          <p className="text-purple-500/80 text-[10px] text-center">
                            Satisfied? Click Download MP4 above — voiceover bakes in automatically.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── How it works ── */}
      <div className="px-8 pb-10">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">How to download</p>
          <ol className="space-y-1.5 text-slate-500 text-xs list-decimal ml-4">
            <li>Click <span className="text-purple-300 font-medium">Add Voiceover</span> → edit script if needed → hit <span className="text-purple-300 font-medium">Generate Voiceover</span></li>
            <li>Preview the audio — regenerate if it sounds off (try different tone tags or switch to Mulberry)</li>
            <li>Click <span className="text-green-400 font-medium">Download MP4</span> → the ad fills the screen automatically</li>
            <li>Chrome shows a "Share this tab" dialog — click <span className="text-white font-medium">Share</span> (make sure "Share tab audio" is checked)</li>
            <li>Recording runs for 32 seconds — the file downloads automatically when done</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

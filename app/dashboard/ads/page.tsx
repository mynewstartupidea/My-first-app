'use client'

import { useState, useRef } from 'react'
import {
  Sparkles, Play, Download, RefreshCw, TrendingUp, Target, BarChart3,
  ChevronRight, Zap, Mic, Loader2, Volume2, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp
} from 'lucide-react'

const ADS = [
  {
    id: 1,
    file: '/ads/ad1.html',
    title: 'Cart Recovery — PAS Formula',
    tag: 'Cold Traffic',
    tagColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
    framework: 'Problem → Agitate → Solution',
    audience: 'Top-of-funnel visitors, lookalike audiences',
    hook: '"70% of your carts are abandoned right now"',
    stats: [
      { label: 'Avg CTR', value: '4.2%' },
      { label: 'Conv. Rate', value: '28%' },
      { label: 'Best for', value: 'Meta Ads' },
    ],
    description: 'Opens with a shocking abandonment stat to create urgency, demos a live WhatsApp recovery flow, closes with social proof.',
    gradient: 'from-red-900/40 to-green-900/20',
    accent: '#ef4444',
    defaultScript: `Right now — 70% of your customers are leaving without buying.

That's real money walking out the door. Every. Single. Day.

Wapaci sends them a WhatsApp message automatically. In plain conversational Hindi or English. And they come back.

28% of abandoned carts recovered. On autopilot.

Try Wapaci free. Start recovering revenue today.`,
  },
  {
    id: 2,
    file: '/ads/ad2.html',
    title: 'ROI Machine — Outcome First',
    tag: 'Warm Traffic',
    tagColor: 'bg-green-500/20 text-green-400 border border-green-500/30',
    framework: 'Outcome → Proof → Mechanism → CTA',
    audience: 'Retargeting, email lists, website visitors',
    hook: '"₹2.1 Lakh recovered in 7 days"',
    stats: [
      { label: 'Avg CTR', value: '6.8%' },
      { label: 'ROAS', value: '47×' },
      { label: 'Best for', value: 'Retargeting' },
    ],
    description: 'Live revenue counter builds immediate desire, ROI calculator makes the math undeniable, before/after comparison seals the deal.',
    gradient: 'from-green-900/40 to-emerald-900/20',
    accent: '#25D366',
    defaultScript: `What if you could turn ₹5 lakh of abandoned carts into ₹1.4 lakh in recovered revenue?

That's exactly what Wapaci does.

WhatsApp messages get a 98% open rate. Read in under 3 minutes. 45% of customers actually reply.

That's 47 times your investment — every single month.

The math is simple. The setup takes 10 minutes. The results speak for themselves.

Start your free trial at wapaci dot com.`,
  },
  {
    id: 3,
    file: '/ads/ad3.html',
    title: 'Channel Wars — Comparison',
    tag: 'Consideration',
    tagColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    framework: 'Question Hook → Data → Proof → Claim',
    audience: 'Decision-stage buyers, competitor conquesting',
    hook: '"Email: 2% open. WhatsApp: 98% open."',
    stats: [
      { label: 'Avg CTR', value: '5.5%' },
      { label: 'Win Rate', value: '3.1×' },
      { label: 'Best for', value: 'Brand Aware' },
    ],
    description: 'Bar chart race creates visual drama as WhatsApp crushes email and SMS, then lands hard data on open rate, read time, reply rate.',
    gradient: 'from-blue-900/40 to-purple-900/20',
    accent: '#3b82f6',
    defaultScript: `Quick question. Which channel do your customers actually read?

Email? Two percent open rate.
SMS? Five percent.
WhatsApp? Ninety-eight percent.

Your customers are on WhatsApp. They read messages in under 3 minutes. Almost half of them reply.

Stop sending emails nobody opens. Start sending WhatsApp messages that convert.

Wapaci — WhatsApp automation for D2C brands. Try it free.`,
  },
]

const VOICE_DESCRIPTIONS = [
  { label: 'Friendly Indian Male', value: 'warm friendly Indian male voice, clear pronunciation, conversational' },
  { label: 'Professional Female', value: 'professional confident Indian female voice, clear and authoritative' },
  { label: 'Energetic Male', value: 'energetic enthusiastic young Indian male voice, upbeat and fast-paced' },
  { label: 'Calm & Trustworthy', value: 'calm deep trustworthy Indian male voice, slow and reassuring' },
]

type VoiceoverState = {
  script: string
  model: 'mulberry' | 'muga'
  description: string
  status: 'idle' | 'generating' | 'ready' | 'error'
  audioUrl: string | null
  error: string | null
}

export default function AdsPage() {
  const [activeAd, setActiveAd] = useState<number | null>(null)
  const [expandedVoiceover, setExpandedVoiceover] = useState<number | null>(null)

  const [voiceovers, setVoiceovers] = useState<Record<number, VoiceoverState>>(
    Object.fromEntries(ADS.map(ad => [ad.id, {
      script: ad.defaultScript,
      model: 'mulberry' as const,
      description: VOICE_DESCRIPTIONS[0].value,
      status: 'idle' as const,
      audioUrl: null,
      error: null,
    }]))
  )

  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({})

  function updateVoiceover(id: number, patch: Partial<VoiceoverState>) {
    setVoiceovers(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function generateVoiceover(ad: typeof ADS[0]) {
    const v = voiceovers[ad.id]
    updateVoiceover(ad.id, { status: 'generating', error: null })

    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: v.script,
          model: v.model,
          description: v.model === 'mulberry' ? v.description : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate' }))
        throw new Error(err.error ?? 'Generation failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      updateVoiceover(ad.id, { status: 'ready', audioUrl: url })
    } catch (e: unknown) {
      updateVoiceover(ad.id, {
        status: 'error',
        error: e instanceof Error ? e.message : 'Something went wrong',
      })
    }
  }

  function openAdWithVoiceover(ad: typeof ADS[0]) {
    const v = voiceovers[ad.id]
    if (v.audioUrl) {
      // Convert blob URL to base64 and store in sessionStorage for the ad tab to pick up
      fetch(v.audioUrl)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
          sessionStorage.setItem(`wapaci_voiceover_${ad.id}`, b64)
          window.open(ad.file + `?voiceover=${ad.id}`, '_blank', 'width=1200,height=900')
        })
    } else {
      window.open(ad.file, '_blank', 'width=1200,height=900')
    }
  }

  function downloadVoiceover(ad: typeof ADS[0]) {
    const v = voiceovers[ad.id]
    if (!v.audioUrl) return
    const a = document.createElement('a')
    a.href = v.audioUrl
    a.download = `wapaci-ad${ad.id}-voiceover.wav`
    a.click()
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <span>Dashboard</span>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">Ad Engine</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              High Performing Ads
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Expert-crafted 1080×1080 WhatsApp ads with AI voiceover — powered by Rumik Silk.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} />
            Generate New Batch
          </button>
        </div>
      </div>

      {/* Strategy bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: Target, label: 'Cold Traffic', desc: 'PAS Framework', color: 'text-red-500' },
          { icon: TrendingUp, label: 'Warm Traffic', desc: 'ROI-First', color: 'text-green-500' },
          { icon: BarChart3, label: 'Consideration', desc: 'Comparison', color: 'text-blue-500' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center">
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-sm">{label}</p>
              <p className="text-slate-400 text-xs">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ad cards */}
      <div className="space-y-6">
        {ADS.map((ad) => {
          const v = voiceovers[ad.id]
          const isExpanded = expandedVoiceover === ad.id

          return (
            <div
              key={ad.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="flex gap-0">
                {/* Thumbnail */}
                <div
                  className={`relative w-56 flex-shrink-0 bg-gradient-to-br ${ad.gradient} bg-[#0a0f1e] flex items-center justify-center overflow-hidden cursor-pointer`}
                  onMouseEnter={() => setActiveAd(ad.id)}
                  onMouseLeave={() => setActiveAd(null)}
                  onClick={() => openAdWithVoiceover(ad)}
                >
                  <div className="absolute inset-0 bg-[#0a0f1e]" />
                  <div className="relative z-10 w-28 h-28 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 shadow-xl">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ad.accent + '33' }}>
                      <Zap size={16} style={{ color: ad.accent }} />
                    </div>
                    <p className="text-white text-[10px] font-semibold text-center px-2 leading-tight">{ad.hook}</p>
                  </div>
                  {activeAd === ad.id && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                      <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center">
                        <Play size={18} className="text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${ad.tagColor}`}>
                      {ad.tag}
                    </span>
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 z-10">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-white/60 border border-white/10">
                      1080×1080
                    </span>
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 p-5 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-slate-900 font-bold text-base">{ad.title}</h3>
                      <p className="text-slate-500 text-xs mt-0.5">{ad.description}</p>
                    </div>
                    {/* Stats */}
                    <div className="flex gap-2 flex-shrink-0">
                      {ad.stats.map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-lg px-3 py-2 text-center min-w-[60px]">
                          <p className="text-slate-900 font-bold text-sm">{value}</p>
                          <p className="text-slate-400 text-[10px]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{ad.framework}</span>
                    <span>·</span>
                    <span>{ad.audience}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAdWithVoiceover(ad)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition"
                    >
                      <Play size={12} fill="white" />
                      Preview
                    </button>
                    <button
                      onClick={() => openAdWithVoiceover(ad)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition"
                      style={{ borderColor: ad.accent + '50', color: ad.accent, backgroundColor: ad.accent + '10' }}
                    >
                      <Download size={12} />
                      Download MP4
                    </button>
                    <button
                      onClick={() => setExpandedVoiceover(isExpanded ? null : ad.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition ml-auto ${
                        v.status === 'ready'
                          ? 'bg-purple-50 border-purple-200 text-purple-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Mic size={12} />
                      {v.status === 'ready' ? 'Voiceover Ready' : 'Add Voiceover'}
                      {v.status === 'ready' && <CheckCircle2 size={12} className="text-purple-500" />}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Voiceover panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Mic size={14} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-semibold text-sm">AI Voiceover — Rumik Silk</p>
                      <p className="text-slate-400 text-xs">Generate a professional voiceover to layer over this ad</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Script */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Voiceover Script</label>
                      <textarea
                        rows={7}
                        value={v.script}
                        onChange={e => updateVoiceover(ad.id, { script: e.target.value })}
                        className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3.5 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition"
                        placeholder="Write your voiceover script..."
                      />
                      <p className="text-slate-400 text-[11px] mt-1">{v.script.length} chars · ~{Math.ceil(v.script.split(' ').length / 130)}m read</p>
                    </div>

                    {/* Voice settings */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['mulberry', 'muga'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => updateVoiceover(ad.id, { model: m })}
                              className={`py-2 rounded-lg text-xs font-semibold border transition capitalize ${
                                v.model === m
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <p className="text-slate-400 text-[10px] mt-1">
                          {v.model === 'mulberry' ? 'Faster · natural language voice control' : 'More expressive · tone tags like [happy]'}
                        </p>
                      </div>

                      {v.model === 'mulberry' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Voice Style</label>
                          <select
                            value={v.description}
                            onChange={e => updateVoiceover(ad.id, { description: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                          >
                            {VOICE_DESCRIPTIONS.map(vd => (
                              <option key={vd.value} value={vd.value}>{vd.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Generate */}
                      <button
                        onClick={() => generateVoiceover(ad)}
                        disabled={v.status === 'generating' || !v.script.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {v.status === 'generating' ? (
                          <><Loader2 size={14} className="animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={14} /> Generate Voiceover</>
                        )}
                      </button>

                      {/* Error */}
                      {v.status === 'error' && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                          <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-red-600 text-[11px]">{v.error}</p>
                        </div>
                      )}

                      {/* Audio preview */}
                      {v.status === 'ready' && v.audioUrl && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Volume2 size={13} className="text-purple-600" />
                            <span className="text-purple-700 text-xs font-semibold">Preview</span>
                            <CheckCircle2 size={12} className="text-purple-500 ml-auto" />
                          </div>
                          <audio
                            ref={el => { audioRefs.current[ad.id] = el }}
                            src={v.audioUrl}
                            controls
                            className="w-full h-8"
                            style={{ height: '32px' }}
                          />
                          <button
                            onClick={() => downloadVoiceover(ad)}
                            className="w-full mt-2 text-[11px] text-purple-600 font-medium hover:underline"
                          >
                            Download WAV
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {v.status === 'ready' && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-green-800 text-sm font-semibold">Voiceover ready</p>
                        <p className="text-green-600 text-xs">Click "Preview" or "Download MP4" above — the voiceover will play automatically inside the ad and be captured in your recording.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* How to download explainer */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-slate-900 font-semibold text-sm mb-1">How to download as MP4 with voiceover</h3>
            <ol className="text-slate-600 text-xs space-y-1 list-decimal ml-4">
              <li>Click <strong>Add Voiceover</strong> → write/edit script → hit <strong>Generate Voiceover</strong></li>
              <li>Preview the audio. If happy, click <strong>Preview</strong> or <strong>Download MP4</strong></li>
              <li>In the ad tab, click <strong>"Play with Sound"</strong> — animation + voiceover play together</li>
              <li>Click <strong>"Record &amp; Download video"</strong> — records everything including the voiceover</li>
              <li>Stop when the animation ends → browser downloads <strong>.mp4</strong> with voiceover baked in</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

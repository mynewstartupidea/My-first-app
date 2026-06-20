'use client'

import { useState } from 'react'
import { Sparkles, Play, Download, RefreshCw, TrendingUp, Target, BarChart3, ChevronRight, Zap } from 'lucide-react'

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
      { label: 'Win Rate', value: '3.1×', },
      { label: 'Best for', value: 'Brand Aware' },
    ],
    description: 'Bar chart race creates visual drama as WhatsApp crushes email and SMS, then lands hard data on open rate, read time, reply rate.',
    gradient: 'from-blue-900/40 to-purple-900/20',
    accent: '#3b82f6',
  },
]

export default function AdsPage() {
  const [activeAd, setActiveAd] = useState<number | null>(null)

  function openAd(file: string) {
    window.open(file, '_blank', 'width=1200,height=900')
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
              Expert-crafted 1080×1080 WhatsApp ads — built by a media buyer, ready to download as MP4.
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {ADS.map((ad) => (
          <div
            key={ad.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            onMouseEnter={() => setActiveAd(ad.id)}
            onMouseLeave={() => setActiveAd(null)}
          >
            {/* Thumbnail / preview area */}
            <div className={`relative h-52 bg-gradient-to-br ${ad.gradient} bg-[#0a0f1e] flex items-center justify-center overflow-hidden`}>
              <div className="absolute inset-0 bg-[#0a0f1e]" />
              {/* Mock canvas preview */}
              <div className="relative z-10 w-36 h-36 rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center justify-center gap-3 shadow-2xl">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ad.accent + '33' }}>
                  <Zap size={20} style={{ color: ad.accent }} />
                </div>
                <div className="text-center px-3">
                  <p className="text-white text-[11px] font-semibold leading-tight">{ad.hook}</p>
                </div>
              </div>
              {/* Play overlay on hover */}
              {activeAd === ad.id && (
                <button
                  onClick={() => openAd(ad.file)}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center hover:scale-110 transition-transform">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </button>
              )}
              {/* Tag */}
              <div className="absolute top-3 left-3 z-10">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${ad.tagColor}`}>
                  {ad.tag}
                </span>
              </div>
              {/* Format badge */}
              <div className="absolute top-3 right-3 z-10">
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-black/40 text-white/70 border border-white/10">
                  1080×1080
                </span>
              </div>
            </div>

            {/* Card body */}
            <div className="p-5">
              <h3 className="text-slate-900 font-bold text-base mb-1">{ad.title}</h3>
              <p className="text-slate-500 text-xs mb-4 leading-relaxed">{ad.description}</p>

              {/* Framework + audience */}
              <div className="space-y-2 mb-4">
                <div className="flex gap-2 items-start">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">Framework</span>
                  <span className="text-[12px] text-slate-700 font-medium">{ad.framework}</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">Audience</span>
                  <span className="text-[12px] text-slate-600">{ad.audience}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {ad.stats.map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <p className="text-slate-900 font-bold text-sm">{value}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openAd(ad.file)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition"
                >
                  <Play size={13} fill="white" />
                  Preview
                </button>
                <button
                  onClick={() => openAd(ad.file)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl border transition"
                  style={{ borderColor: ad.accent + '50', color: ad.accent, backgroundColor: ad.accent + '10' }}
                >
                  <Download size={13} />
                  Download MP4
                </button>
              </div>
              <p className="text-slate-400 text-[10px] text-center mt-2.5">
                Opens ad → click "Record & Download" to save as MP4
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* How to download explainer */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-slate-900 font-semibold text-sm mb-1">How to download as MP4</h3>
            <ol className="text-slate-600 text-xs space-y-1 list-decimal ml-4">
              <li>Click <strong>Preview</strong> or <strong>Download MP4</strong> — the ad opens in a new tab</li>
              <li>Click <strong>"Play with Sound"</strong> to start the animation</li>
              <li>Then click <strong>"Record &amp; Download video"</strong> — it records the tab automatically</li>
              <li>When it says <strong>"Recording... (click to stop)"</strong>, wait for the 30s animation to finish</li>
              <li>Click to stop → your browser downloads the file as <strong>.mp4</strong></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

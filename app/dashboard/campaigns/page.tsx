'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Megaphone, Plus, Users, BarChart2, Clock, ArrowRight, Zap,
  Loader2, X, CheckCircle2, AlertCircle, Send, CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Campaign, CampaignAudience } from '@/types'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  scheduled: 'bg-amber-100 text-amber-700',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
}

const AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  all:          'All customers with WhatsApp opt-in',
  opted_in:     'WhatsApp opted-in customers only',
  inactive_30:  'Inactive 30+ days (no order in 30 days)',
  inactive_60:  'Inactive 60+ days (win-back segment)',
  inactive_90:  'Inactive 90+ days (deep win-back)',
}

const TEMPLATE_SUGGESTIONS = [
  { label: 'Win-back offer', text: 'Hi {{name}}! We miss you 💚 It\'s been a while since your last order. Here\'s a special 15% off just for you → [SHOP_LINK]\n\nCode: COMEBACK15 (valid 48 hrs)' },
  { label: 'New collection', text: 'Hi {{name}}! Our new collection just dropped 🔥 Check it out before it sells out → [SHOP_LINK]' },
  { label: 'Festive offer',  text: 'Hi {{name}}! Happy celebrations! 🎉 Enjoy 20% off our bestsellers this festive season. Shop now → [SHOP_LINK]' },
  { label: 'Loyalty thank you', text: 'Hi {{name}}! Thank you for being a valued customer ❤️ Here\'s a special gift: 10% off your next order → Code: THANKYOU10' },
]

// ─── Creator Modal ─────────────────────────────────────────────────────────────

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]         = useState('')
  const [message, setMessage]   = useState('')
  const [audience, setAudience] = useState<CampaignAudience>('opted_in')
  const [sendNow, setSendNow]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [step, setStep]         = useState<'compose' | 'review'>('compose')

  async function handleCreate() {
    if (!name.trim() || !message.trim()) { setError('Name and message are required.'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), message: message.trim(), audience }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Failed to create campaign'); setLoading(false); return }

    if (sendNow && data.campaign?.id) {
      const sendRes = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: data.campaign.id }),
      })
      const sendData = await sendRes.json()
      if (!sendRes.ok) {
        setError(sendData.error ?? 'Campaign created but sending failed')
        setLoading(false)
        onCreated()
        return
      }
    }

    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Campaign</h2>
            <p className="text-slate-500 text-sm mt-0.5">Create a WhatsApp broadcast campaign</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {step === 'compose' ? (
            <>
              {/* Campaign name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Summer Win-back Offer"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              {/* Audience */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Target audience</label>
                <div className="space-y-2">
                  {(Object.keys(AUDIENCE_LABELS) as CampaignAudience[]).map(key => (
                    <label key={key} className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition',
                      audience === key ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                    )}>
                      <input
                        type="radio"
                        className="mt-0.5 accent-[#25D366]"
                        checked={audience === key}
                        onChange={() => setAudience(key)}
                      />
                      <span className="text-sm text-slate-700">{AUDIENCE_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Message</label>
                  <span className="text-xs text-slate-400">{'{{name}}'} = customer name</span>
                </div>

                {/* Template suggestions */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TEMPLATE_SUGGESTIONS.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setMessage(t.text)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Hi {{name}}! We have a special offer for you..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{message.length} characters</p>
              </div>
            </>
          ) : (
            /* Review step */
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Campaign</span>
                  <span className="font-medium text-slate-800">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Audience</span>
                  <span className="font-medium text-slate-800 text-right max-w-[200px]">{AUDIENCE_LABELS[audience]}</span>
                </div>
              </div>

              <div className="bg-[#111827] rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-2">Message preview</p>
                <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                  {message.replace(/\{\{name\}\}/g, 'Customer')}
                </p>
              </div>

              {/* Send now toggle */}
              <div className="flex items-center justify-between p-4 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <Send className="w-4 h-4 text-[#25D366]" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Send immediately</p>
                    <p className="text-xs text-slate-500">Sends to audience right now</p>
                  </div>
                </div>
                <button
                  onClick={() => setSendNow(v => !v)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    sendNow ? 'bg-[#25D366]' : 'bg-slate-200'
                  )}
                >
                  <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', sendNow ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>

              {!sendNow && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                  <CalendarDays className="w-4 h-4 flex-shrink-0" />
                  Campaign will be saved as a draft. You can send it later from the campaigns list.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3">
          {step === 'review' && (
            <button onClick={() => setStep('compose')} className="text-sm text-slate-500 hover:text-slate-700 transition">
              ← Back
            </button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">
              Cancel
            </button>
            {step === 'compose' ? (
              <button
                onClick={() => { setError(''); if (!name.trim() || !message.trim()) { setError('Fill in name and message.'); return } setStep('review') }}
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
              >
                Review <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : sendNow ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {loading ? 'Creating…' : sendNow ? 'Create & Send' : 'Save Draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [hasStore, setHasStore]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [sending, setSending]     = useState<string | null>(null)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const { data } = await supabase
      .from('campaigns').select('*').eq('store_id', store.id).order('created_at', { ascending: false })

    setCampaigns(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function sendCampaign(id: string) {
    setSending(id)
    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id }),
    })
    const data = await res.json()
    setSending(null)
    if (res.ok) {
      showToast(`Sent to ${data.sentCount} customers!`)
      load()
    } else {
      showToast(data.error ?? 'Failed to send campaign', false)
    }
  }

  const totalReached  = campaigns.reduce((a, c) => a + c.sent_count, 0)
  const completedCount = campaigns.filter(c => c.status === 'completed').length

  return (
    <div className="p-6 lg:p-8">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); showToast('Campaign created!') }}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">One-time broadcast and win-back WhatsApp campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-green-500/20"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Campaigns', value: campaigns.length,   icon: Megaphone, color: 'bg-purple-100 text-purple-600' },
          { label: 'Total Reached',   value: totalReached,       icon: Users,     color: 'bg-blue-100 text-blue-600'   },
          { label: 'Completed',       value: completedCount,     icon: BarChart2, color: 'bg-green-100 text-green-600' },
          { label: 'Drafts',          value: campaigns.filter(c => c.status === 'draft').length, icon: Zap, color: 'bg-orange-100 text-orange-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-slate-500 text-xs font-medium">{label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color.split(' ')[0]}`}>
                <Icon className={`w-4 h-4 ${color.split(' ')[1]}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
        </div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <Megaphone className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store to run campaigns</p>
          <Link href="/dashboard/integrations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
            Connect store <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-[#25D366]" />
          </div>
          <p className="font-semibold text-slate-800 text-lg">No campaigns yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Create your first WhatsApp campaign to re-engage customers, promote offers, or run win-back sequences.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Create first campaign
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {campaigns.map(c => (
              <div key={c.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[c.status])}>
                      {c.status}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {AUDIENCE_LABELS[c.audience as CampaignAudience] ?? c.audience}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mb-1">{c.message.slice(0, 80)}{c.message.length > 80 ? '…' : ''}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {c.sent_count > 0 && (
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.sent_count} sent</span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.status === 'draft' && (
                    <button
                      onClick={() => sendCampaign(c.id)}
                      disabled={sending === c.id}
                      className="flex items-center gap-1.5 text-xs font-medium bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white px-3 py-1.5 rounded-xl transition"
                    >
                      {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send now
                    </button>
                  )}
                  {c.status === 'completed' && (
                    <div className="text-xs text-slate-400 text-right">
                      <p className="font-semibold text-slate-700">{c.sent_count} sent</p>
                      {c.failed_count > 0 && <p className="text-red-500">{c.failed_count} failed</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

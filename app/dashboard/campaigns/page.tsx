'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Megaphone, Plus, Users, Send, Loader2, X, CheckCircle2,
  AlertCircle, Clock, BarChart2, Eye, Copy, IndianRupee,
  ArrowRight, Zap, CalendarDays, ChevronRight, MessageSquare,
  Tag, Sparkles, TrendingUp, Star, Gift, ShoppingBag, Repeat
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, timeAgo } from '@/lib/utils'

type CampaignAudience = 'all' | 'opted_in' | 'inactive_30' | 'inactive_60' | 'inactive_90' | 'vip' | 'repeat_buyers' | 'first_time'

interface Campaign {
  id: string
  name: string
  message: string
  audience: string
  status: string
  campaign_type?: string
  sent_count: number
  delivered_count: number
  read_count?: number
  revenue_attributed?: number
  failed_count: number
  scheduled_at: string | null
  created_at: string
}

interface Template { id: string; name: string; body: string; category: string }
interface CustomerCounts { [key: string]: number }

const CAMPAIGN_TYPES = [
  { id: 'broadcast',      label: 'Broadcast',       icon: Megaphone,    desc: 'One-time message to your audience',       color: 'text-blue-600 bg-blue-50' },
  { id: 'flash_sale',     label: 'Flash Sale',      icon: Zap,          desc: 'Urgent limited-time offer',               color: 'text-amber-600 bg-amber-50' },
  { id: 'product_launch', label: 'Product Launch',  icon: Sparkles,     desc: 'Announce a new product or collection',    color: 'text-purple-600 bg-purple-50' },
  { id: 'win_back',       label: 'Win-back',        icon: Repeat,       desc: 'Re-engage inactive customers',            color: 'text-red-600 bg-red-50' },
  { id: 'vip_campaign',   label: 'VIP Campaign',    icon: Star,         desc: 'Exclusive offer for your best customers', color: 'text-emerald-600 bg-emerald-50' },
  { id: 'festival',       label: 'Festival Offer',  icon: Gift,         desc: 'Festive season promotions',               color: 'text-orange-600 bg-orange-50' },
]

const AUDIENCE_CONFIG: Array<{ id: CampaignAudience; label: string; desc: string }> = [
  { id: 'opted_in',      label: 'WhatsApp Opt-in',  desc: 'All customers opted into WhatsApp' },
  { id: 'vip',           label: 'VIP (₹5k+)',        desc: 'Customers who spent over ₹5,000' },
  { id: 'repeat_buyers', label: 'Repeat Buyers',     desc: '2+ orders placed' },
  { id: 'inactive_30',   label: 'Inactive 30d',      desc: 'No order in last 30 days' },
  { id: 'inactive_60',   label: 'Inactive 60d',      desc: 'No order in last 60 days — win-back' },
  { id: 'first_time',    label: 'First-timers',      desc: 'Customers with exactly 1 order' },
  { id: 'all',           label: 'Everyone',          desc: 'All contacts in your store' },
]

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  scheduled: 'bg-amber-50 text-amber-700',
  running:   'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-600',
  failed:    'bg-red-50 text-red-600',
}

const QUICK_TEMPLATES = [
  { label: 'Flash Sale',      text: 'Hi {{name}}! ⚡ FLASH SALE — 30% off everything today only!\n\nShop now before it sells out → [YOUR_LINK]\n\nCode: FLASH30 (expires midnight)' },
  { label: 'Win-back',        text: 'Hi {{name}}! 👋 We miss you at [STORE_NAME]!\n\nIt\'s been a while — here\'s 15% off just for you.\nCode: COMEBACK15\n\nShop now → [YOUR_LINK]' },
  { label: 'New Launch',      text: 'Hi {{name}}! 🚀 Something exciting just dropped!\n\nOur new [PRODUCT_NAME] is now live. Be among the first to grab it → [YOUR_LINK]' },
  { label: 'Festival Offer',  text: 'Hi {{name}}! 🎉 Wishing you a happy festive season!\n\nCelebrate with 20% off our bestsellers.\nCode: FESTIVE20 → [YOUR_LINK]' },
  { label: 'VIP Exclusive',   text: 'Hi {{name}}! 👑 As one of our VIP customers, you get first access to our exclusive sale.\n\nEarly access link → [YOUR_LINK]\n\nValid for 24 hours only.' },
  { label: 'Back in Stock',   text: 'Hi {{name}}! Good news — [PRODUCT_NAME] is back in stock! 🔥\n\nGrab yours before it sells out again → [YOUR_LINK]' },
]

// ─── Campaign Creator Modal ─────────────────────────────────────────────────────

function CreateCampaignModal({
  onClose, onCreated, templates, customerCounts
}: {
  onClose: () => void
  onCreated: () => void
  templates: Template[]
  customerCounts: CustomerCounts
}) {
  const [step, setStep]               = useState<'type' | 'compose' | 'audience' | 'review'>('type')
  const [campaignType, setCampaignType] = useState('')
  const [name, setName]               = useState('')
  const [message, setMessage]         = useState('')
  const [audience, setAudience]       = useState<CampaignAudience>('opted_in')
  const [sendNow, setSendNow]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  async function handleCreate() {
    if (!name.trim() || !message.trim()) { setError('Name and message are required.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), message: message.trim(), audience, campaign_type: campaignType }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create campaign'); setLoading(false); return }
    if (sendNow && data.campaign?.id) {
      await fetch('/api/campaigns/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: data.campaign.id }),
      })
    }
    setLoading(false); onCreated(); onClose()
  }

  const steps = ['type', 'compose', 'audience', 'review']
  const stepIdx = steps.indexOf(step)
  const audienceCount = customerCounts[audience] ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">New Campaign</h2>
            <div className="flex items-center gap-1 mt-1">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition',
                    i < stepIdx ? 'bg-[#25D366] text-white' : i === stepIdx ? 'bg-[#25D366] text-white' : 'bg-slate-200 text-slate-400')}>
                    {i < stepIdx ? '✓' : i + 1}
                  </div>
                  {i < steps.length - 1 && <div className={cn('w-6 h-0.5', i < stepIdx ? 'bg-[#25D366]' : 'bg-slate-200')} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Step 1: Campaign type */}
          {step === 'type' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">What type of campaign?</p>
              <div className="grid grid-cols-2 gap-2">
                {CAMPAIGN_TYPES.map(t => (
                  <button key={t.id} onClick={() => { setCampaignType(t.id); if (!name) setName(t.label + ' Campaign') }}
                    className={cn('flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition',
                      campaignType === t.id ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300')}>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', t.color.split(' ')[1])}>
                      <t.icon size={16} className={t.color.split(' ')[0]} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{t.desc}</p>
                    </div>
                    {campaignType === t.id && <CheckCircle2 size={14} className="text-[#25D366] ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Compose */}
          {step === 'compose' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Diwali Flash Sale 2025"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/50" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Message</label>
                  <button onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-1 text-xs text-[#25D366] hover:underline font-medium">
                    <Tag size={11} /> {showTemplates ? 'Hide' : 'Use Template'}
                  </button>
                </div>

                {showTemplates && (
                  <div className="mb-3 grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1">Quick Templates</p>
                    {QUICK_TEMPLATES.map(t => (
                      <button key={t.label} onClick={() => { setMessage(t.text); setShowTemplates(false) }}
                        className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition text-xs text-slate-700">
                        <span className="font-medium">{t.label}</span>
                        <span className="text-slate-400 ml-2">{t.text.slice(0, 40)}…</span>
                      </button>
                    ))}
                    {templates.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mt-1 mb-1">Your Templates</p>
                        {templates.map(t => (
                          <button key={t.id} onClick={() => { setMessage(t.body); setShowTemplates(false) }}
                            className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition text-xs text-slate-700">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-slate-400 ml-2">{t.body.slice(0, 40)}…</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                <textarea rows={6} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Hi {{name}}! ..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 resize-none" />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-400">{'{{name}}'} = customer name</p>
                  <p className="text-xs text-slate-400">{message.length} chars</p>
                </div>
              </div>

              {/* Live preview */}
              {message && (
                <div className="bg-[#e5ddd5] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Preview</p>
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[80%] shadow-sm">
                    <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                      {message.replace(/\{\{name\}\}/g, 'Priya')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Audience */}
          {step === 'audience' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Who receives this campaign?</p>
              <p className="text-xs text-slate-400 mb-3">Recipients are pulled from your uploaded contacts.</p>

              {/* No contacts warning */}
              {(customerCounts['all'] ?? 0) === 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-3">
                  <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">No contacts yet</p>
                    <p className="text-xs text-amber-700 mt-0.5">Upload your customer contacts first so this campaign has recipients.</p>
                    <a href="/dashboard/contacts" target="_blank"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline mt-1.5">
                      Go to Contacts → Upload
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {AUDIENCE_CONFIG.map(a => {
                  const count = customerCounts[a.id] ?? 0
                  return (
                    <label key={a.id}
                      className={cn('flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition',
                        audience === a.id ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300')}>
                      <input type="radio" className="accent-[#25D366]" checked={audience === a.id} onChange={() => setAudience(a.id)} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                        <p className="text-xs text-slate-400">{a.desc}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn('text-sm font-bold block', audience === a.id ? 'text-[#25D366]' : count > 0 ? 'text-slate-700' : 'text-slate-300')}>
                          {count.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">contacts</span>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Reach summary */}
              {(customerCounts[audience] ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-[#25D366]/8 border border-[#25D366]/20 rounded-xl px-4 py-2.5">
                  <Users size={13} className="text-[#25D366]" />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-[#25D366]">{(customerCounts[audience] ?? 0).toLocaleString()}</span> contacts will receive this message
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
                {[
                  { label: 'Campaign', value: name },
                  { label: 'Type', value: CAMPAIGN_TYPES.find(t => t.id === campaignType)?.label ?? campaignType },
                  { label: 'Audience', value: AUDIENCE_CONFIG.find(a => a.id === audience)?.label ?? audience },
                  { label: 'Recipients', value: `~${(customerCounts[audience] ?? 0).toLocaleString()} customers` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-semibold text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#e5ddd5] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Message Preview</p>
                <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                  <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                    {message.replace(/\{\{name\}\}/g, 'Priya')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Send immediately</p>
                  <p className="text-xs text-slate-500">Campaign will be sent to all recipients now</p>
                </div>
                <button onClick={() => setSendNow(v => !v)}
                  className={cn('relative h-6 w-11 rounded-full transition-colors flex-shrink-0', sendNow ? 'bg-[#25D366]' : 'bg-slate-200')}>
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all', sendNow ? 'left-6' : 'left-1')} />
                </button>
              </div>

              {!sendNow && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                  <CalendarDays size={13} /> Saved as draft — send anytime from campaigns list
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={() => { if (stepIdx > 0) setStep(steps[stepIdx - 1] as typeof step) }}
            className={cn('text-sm text-slate-500 hover:text-slate-700 transition', stepIdx === 0 ? 'invisible' : '')}>
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 transition">Cancel</button>
            {step !== 'review' ? (
              <button
                onClick={() => {
                  setError('')
                  if (step === 'type' && !campaignType) { setError('Select a campaign type.'); return }
                  if (step === 'compose' && (!name.trim() || !message.trim())) { setError('Name and message required.'); return }
                  setStep(steps[stepIdx + 1] as typeof step)
                }}
                className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1aad54] text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleCreate} disabled={loading}
                className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                {loading ? <Loader2 size={14} className="animate-spin" /> : sendNow ? <Send size={14} /> : <CheckCircle2 size={14} />}
                {loading ? 'Creating…' : sendNow ? 'Create & Send' : 'Save Draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [templates, setTemplates]     = useState<Template[]>([])
  const [customerCounts, setCounts]   = useState<CustomerCounts>({})
  const [loading, setLoading]         = useState(true)
  const [hasStore, setHasStore]       = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [sending, setSending]         = useState<string | null>(null)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: store } = await supabase.from('stores').select('id').eq('user_id', user.id)
      .eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (!store) { setHasStore(false); setLoading(false); return }
    setHasStore(true)

    const [campsRes, tmplRes, custsRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('store_id', store.id).order('created_at', { ascending: false }),
      supabase.from('templates').select('id,name,body,category').eq('user_id', user.id).eq('is_archived', false).limit(50),
      supabase.from('customers').select('phone,whatsapp_opt_in,total_orders,total_spent,last_order_at').eq('store_id', store.id),
    ])

    setCampaigns(campsRes.data ?? [])
    setTemplates(tmplRes.data ?? [])

    const custs = custsRes.data ?? []
    const now = Date.now()
    setCounts({
      all:           custs.length,
      opted_in:      custs.filter(c => c.whatsapp_opt_in).length,
      vip:           custs.filter(c => c.total_spent >= 5000).length,
      repeat_buyers: custs.filter(c => c.total_orders >= 2).length,
      first_time:    custs.filter(c => c.total_orders <= 1).length,
      inactive_30:   custs.filter(c => c.last_order_at && now - new Date(c.last_order_at).getTime() > 30 * 86400000).length,
      inactive_60:   custs.filter(c => c.last_order_at && now - new Date(c.last_order_at).getTime() > 60 * 86400000).length,
      inactive_90:   custs.filter(c => c.last_order_at && now - new Date(c.last_order_at).getTime() > 90 * 86400000).length,
    })

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function sendCampaign(id: string) {
    setSending(id)
    const res = await fetch('/api/campaigns/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id }),
    })
    const data = await res.json()
    setSending(null)
    if (res.ok) { showToast(`Sent to ${data.sentCount} customers!`); load() }
    else showToast(data.error ?? 'Failed', false)
  }

  async function duplicateCampaign(c: Campaign) {
    const res = await fetch('/api/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: c.name + ' (Copy)', message: c.message, audience: c.audience }),
    })
    if (res.ok) { showToast('Campaign duplicated'); load() }
  }

  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue_attributed ?? 0), 0)
  const totalSent    = campaigns.reduce((s, c) => s + c.sent_count, 0)
  const completed    = campaigns.filter(c => c.status === 'completed').length

  const typeIcon: Record<string, React.ElementType> = {
    broadcast: Megaphone, flash_sale: Zap, product_launch: Sparkles,
    win_back: Repeat, vip_campaign: Star, festival: Gift,
  }

  return (
    <div className="p-6 lg:p-8">
      {toast && (
        <div className={cn('fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold',
          toast.ok ? 'bg-[#25D366] text-white' : 'bg-red-500 text-white')}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {toast.msg}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); showToast('Campaign created!') }}
          templates={templates}
          customerCounts={customerCounts}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-0.5">WhatsApp broadcast campaigns for revenue generation</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1aad54] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-green-500/20">
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Campaigns', value: campaigns.length,    icon: Megaphone,    cls: 'text-purple-600 bg-purple-50' },
          { label: 'Total Sent',      value: totalSent.toLocaleString(), icon: Send, cls: 'text-blue-600 bg-blue-50' },
          { label: 'Completed',       value: completed,           icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
          { label: 'Revenue',         value: formatCurrency(totalRevenue), icon: IndianRupee, cls: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', s.cls.split(' ')[1])}>
                <s.icon size={14} className={s.cls.split(' ')[0]} />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-[#25D366]" /></div>
      ) : !hasStore ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <Megaphone size={36} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Connect your store first</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
          <div className="w-14 h-14 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone size={24} className="text-[#25D366]" />
          </div>
          <p className="font-bold text-slate-800">No campaigns yet</p>
          <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Create a WhatsApp broadcast to re-engage customers and generate revenue.</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-5 inline-flex items-center gap-2 bg-[#25D366] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1aad54] transition">
            <Plus size={14} /> Create first campaign
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[auto_1fr_110px_80px_80px_80px_100px_100px] gap-4 px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50 border-b border-slate-100">
            <div className="w-5" />
            <div>Campaign</div><div>Audience</div><div>Sent</div><div>Delivered</div><div>Read</div><div>Revenue</div><div>Actions</div>
          </div>

          <div className="divide-y divide-slate-50">
            {campaigns.map(c => {
              const TypeIcon = typeIcon[c.campaign_type ?? 'broadcast'] ?? Megaphone
              const delivRate = c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0
              const readRate  = c.sent_count > 0 ? Math.round(((c.read_count ?? 0) / c.sent_count) * 100) : 0
              const expanded  = expandedId === c.id

              return (
                <div key={c.id}>
                  <div className="flex lg:grid lg:grid-cols-[auto_1fr_110px_80px_80px_80px_100px_100px] items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon size={14} className="text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize', STATUS_STYLES[c.status])}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{c.message.slice(0, 60)}…</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{timeAgo(c.created_at)}</p>
                    </div>
                    <div className="hidden lg:block text-xs text-slate-500 truncate">
                      {AUDIENCE_CONFIG.find(a => a.id === c.audience)?.label ?? c.audience}
                    </div>
                    <div className="hidden lg:block text-sm font-semibold text-slate-700">{c.sent_count.toLocaleString()}</div>
                    <div className="hidden lg:block text-xs">
                      <span className="font-semibold text-slate-700">{c.delivered_count}</span>
                      {c.sent_count > 0 && <span className="text-slate-400 ml-1">({delivRate}%)</span>}
                    </div>
                    <div className="hidden lg:block text-xs">
                      <span className="font-semibold text-slate-700">{c.read_count ?? 0}</span>
                      {c.sent_count > 0 && <span className="text-slate-400 ml-1">({readRate}%)</span>}
                    </div>
                    <div className="hidden lg:block text-sm font-semibold text-emerald-600">
                      {c.revenue_attributed ? formatCurrency(c.revenue_attributed) : '—'}
                    </div>
                    <div className="hidden lg:flex items-center gap-1.5">
                      {c.status === 'draft' && (
                        <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                          className="flex items-center gap-1 text-xs font-semibold bg-[#25D366] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#1aad54] disabled:opacity-50 transition">
                          {sending === c.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Send
                        </button>
                      )}
                      <button onClick={() => duplicateCampaign(c)} title="Duplicate"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                        <Copy size={13} />
                      </button>
                      <button onClick={() => setExpandedId(expanded ? null : c.id)} title="Analytics"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                        <BarChart2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded analytics */}
                  {expanded && c.status === 'completed' && (
                    <div className="px-5 pb-4 bg-slate-50/50 border-t border-slate-100">
                      <div className="grid grid-cols-4 gap-4 pt-4">
                        {[
                          { label: 'Sent', value: c.sent_count, color: 'text-slate-700' },
                          { label: 'Delivered', value: c.delivered_count, sub: `${delivRate}%`, color: 'text-blue-600' },
                          { label: 'Read', value: c.read_count ?? 0, sub: `${readRate}%`, color: 'text-purple-600' },
                          { label: 'Revenue', value: c.revenue_attributed ? formatCurrency(c.revenue_attributed) : '₹0', color: 'text-emerald-600' },
                        ].map(m => (
                          <div key={m.label} className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                            <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
                            <p className="text-xs text-slate-500">{m.label}</p>
                            {m.sub && <p className="text-[10px] text-slate-400">{m.sub} rate</p>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 h-full" style={{ width: `${delivRate}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>0%</span><span>Delivery rate: {delivRate}%</span><span>100%</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

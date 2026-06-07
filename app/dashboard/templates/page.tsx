'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Plus, Star, Copy, Archive, Trash2, X, Save,
  Loader2, CheckCircle2, AlertCircle, Search, Wand2,
  ShoppingCart, Package, Truck, RotateCcw, MessageSquare,
  Gift, Bell, Sparkles, Heart, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Built-in template data ───────────────────────────────────────────────────

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: 'abandoned_cart',
    name: 'Abandoned Cart Recovery',
    category: 'abandoned_cart',
    icon: ShoppingCart,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    body: 'Hi {{name}}! 👋 You left something in your cart at {{shop_name}}.\n\nYour items are still waiting for you! Complete your purchase before they sell out:\n👉 {{cart_url}}\n\nNeed help? Just reply to this message.',
    variables: ['{{name}}', '{{shop_name}}', '{{cart_url}}'],
  },
  {
    key: 'abandoned_cart_discount',
    name: 'Abandoned Cart with Discount',
    category: 'abandoned_cart',
    icon: ShoppingCart,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    body: 'Hi {{name}}! 🛒 Your cart at {{shop_name}} is still waiting.\n\nHere\'s a special offer just for you:\n✨ Use code *{{discount_code}}* for {{discount_value}}% off!\n\nComplete your order here:\n👉 {{cart_url}}\n\n(Offer expires in 24 hours)',
    variables: ['{{name}}', '{{shop_name}}', '{{cart_url}}', '{{discount_code}}', '{{discount_value}}'],
  },
  {
    key: 'cod_confirmation',
    name: 'COD Order Confirmation',
    category: 'cod_verification',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    body: 'Hi {{name}}! 📦 Your COD order #{{order_number}} for ₹{{amount}} at {{shop_name}} is ready to be dispatched.\n\nPlease confirm:\n✅ Reply *YES* to confirm\n❌ Reply *NO* to cancel\n\nIf we don\'t hear back in 2 hours, we\'ll proceed with dispatch.',
    variables: ['{{name}}', '{{order_number}}', '{{amount}}', '{{shop_name}}'],
  },
  {
    key: 'order_shipped',
    name: 'Order Shipped Notification',
    category: 'shipping_update',
    icon: Truck,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    body: 'Hi {{name}}! 🚚 Great news — your order #{{order_number}} from {{shop_name}} is on its way!\n\nTrack your delivery:\n📍 {{tracking_url}}\n\nExpected delivery: 3–5 business days. Thank you for shopping with us! ❤️',
    variables: ['{{name}}', '{{order_number}}', '{{shop_name}}', '{{tracking_url}}'],
  },
  {
    key: 'order_delivered',
    name: 'Order Delivered',
    category: 'order_confirmation',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100',
    body: 'Hi {{name}}! 🎉 Your order #{{order_number}} has been delivered!\n\nWe hope you love your purchase from {{shop_name}}. Your satisfaction means everything to us.\n\nHaving any issues? Reply to this message and we\'ll sort it out immediately.',
    variables: ['{{name}}', '{{order_number}}', '{{shop_name}}'],
  },
  {
    key: 'review_request',
    name: 'Review Request',
    category: 'review_request',
    icon: Star,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    body: 'Hi {{name}}! 😊 We hope you\'re loving your recent purchase from {{shop_name}}!\n\nWould you take 2 minutes to share your experience? Your review helps other shoppers and means a lot to us:\n⭐ {{review_url}}\n\nThank you so much!',
    variables: ['{{name}}', '{{shop_name}}', '{{review_url}}'],
  },
  {
    key: 'win_back',
    name: 'Win-Back Campaign',
    category: 'win_back',
    icon: RotateCcw,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    body: 'Hi {{name}}! We miss you at {{shop_name}} 💚\n\nIt\'s been a while since your last visit. As a valued customer, here\'s an exclusive offer just for you:\n\n🎁 *{{discount_value}}% OFF* your next order\n🔑 Code: *{{discount_code}}*\n\nShop now → {{shop_url}}\n\n(Valid for 48 hours only)',
    variables: ['{{name}}', '{{shop_name}}', '{{discount_value}}', '{{discount_code}}', '{{shop_url}}'],
  },
  {
    key: 'welcome_message',
    name: 'Welcome Message',
    category: 'welcome',
    icon: Heart,
    color: 'text-pink-600',
    bg: 'bg-pink-100',
    body: 'Welcome to {{shop_name}}, {{name}}! 🎉\n\nThank you for joining our family. We\'re thrilled to have you!\n\nHere\'s a little gift to get you started:\n🎁 *10% off* your first order — Code: *WELCOME10*\n\nStart shopping → {{shop_url}}\n\nFeel free to reply with any questions!',
    variables: ['{{name}}', '{{shop_name}}', '{{shop_url}}'],
  },
  {
    key: 'new_product_launch',
    name: 'New Product Launch',
    category: 'campaign',
    icon: Bell,
    color: 'text-teal-600',
    bg: 'bg-teal-100',
    body: 'Hi {{name}}! 🔥 Big news from {{shop_name}}!\n\nWe just launched something you\'re going to love:\n✨ *{{product_name}}*\n\nBe among the first to grab it before it sells out:\n👉 {{product_url}}\n\nEarly-bird discount: *{{discount_value}}% off* — use code *{{discount_code}}*',
    variables: ['{{name}}', '{{shop_name}}', '{{product_name}}', '{{product_url}}', '{{discount_value}}', '{{discount_code}}'],
  },
  {
    key: 'back_in_stock',
    name: 'Back in Stock Alert',
    category: 'campaign',
    icon: Gift,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
    body: 'Hi {{name}}! 🎊 Great news — *{{product_name}}* is back in stock at {{shop_name}}!\n\nYou expressed interest earlier, so we wanted you to know first. Grab it before it sells out again:\n\n👉 {{product_url}}\n\nHurry — limited stock available!',
    variables: ['{{name}}', '{{shop_name}}', '{{product_name}}', '{{product_url}}'],
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuiltinTemplate {
  key: string
  name: string
  category: string
  icon: React.ElementType
  color: string
  bg: string
  body: string
  variables: string[]
}

interface SavedTemplate {
  id: string
  name: string
  category: string
  body: string
  variables: string[]
  is_favorite: boolean
  is_archived: boolean
  is_builtin: boolean
  created_at: string
}

type TabKey = 'library' | 'my_templates'

const CATEGORY_LABELS: Record<string, string> = {
  abandoned_cart:    'Abandoned Cart',
  cod_verification:  'COD',
  order_confirmation:'Order',
  shipping_update:   'Shipping',
  win_back:          'Win-back',
  review_request:    'Review',
  post_purchase:     'Post-Purchase',
  welcome:           'Welcome',
  campaign:          'Campaign',
  custom:            'Custom',
}

// ─── Template Card ────────────────────────────────────────────────────────────

function BuiltinCard({
  tmpl, onClone, cloning,
}: {
  tmpl: BuiltinTemplate
  onClone: (t: BuiltinTemplate) => void
  cloning: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = tmpl.icon

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', tmpl.bg)}>
            <Icon className={cn('w-5 h-5', tmpl.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800 text-sm">{tmpl.name}</p>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {CATEGORY_LABELS[tmpl.category] ?? tmpl.category}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {tmpl.variables.slice(0, 4).map(v => (
                <span key={v} className="text-[9px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{v}</span>
              ))}
              {tmpl.variables.length > 4 && (
                <span className="text-[9px] text-slate-400">+{tmpl.variables.length - 4} more</span>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div
          className={cn(
            'bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-line leading-relaxed cursor-pointer transition',
            expanded ? '' : 'line-clamp-3'
          )}
          onClick={() => setExpanded(v => !v)}
        >
          {tmpl.body}
        </div>
        {!expanded && (
          <button onClick={() => setExpanded(true)} className="text-[11px] text-slate-400 hover:text-slate-600 mt-1 transition">
            Show full template ↓
          </button>
        )}
      </div>

      <div className="px-5 pb-5 flex items-center gap-2">
        <button
          onClick={() => onClone(tmpl)}
          disabled={cloning === tmpl.key}
          className="flex items-center gap-1.5 text-xs font-medium bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white px-3 py-1.5 rounded-xl transition"
        >
          {cloning === tmpl.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
          {cloning === tmpl.key ? 'Cloning…' : 'Clone & Edit'}
        </button>
      </div>
    </div>
  )
}

// ─── Saved Template Card ──────────────────────────────────────────────────────

function SavedCard({
  tmpl, onFavorite, onArchive, onDelete, onEdit,
}: {
  tmpl: SavedTemplate
  onFavorite: (id: string, val: boolean) => void
  onArchive: (id: string, val: boolean) => void
  onDelete: (id: string) => void
  onEdit: (tmpl: SavedTemplate) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden',
      tmpl.is_archived ? 'opacity-60 border-slate-100' : 'border-slate-100'
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800 text-sm">{tmpl.name}</p>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {CATEGORY_LABELS[tmpl.category] ?? tmpl.category}
              </span>
              {tmpl.is_favorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
              {tmpl.is_archived && <Archive className="w-3 h-3 text-slate-400" />}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onFavorite(tmpl.id, !tmpl.is_favorite)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition"
              title={tmpl.is_favorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star className={cn('w-3.5 h-3.5', tmpl.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-slate-400')} />
            </button>
            <button
              onClick={() => onEdit(tmpl)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-700"
              title="Edit"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onArchive(tmpl.id, !tmpl.is_archived)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-700"
              title={tmpl.is_archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(tmpl.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 transition text-slate-400 hover:text-red-500"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className={cn('bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-line leading-relaxed cursor-pointer', !expanded && 'line-clamp-3')}
          onClick={() => setExpanded(v => !v)}
        >
          {tmpl.body}
        </div>
      </div>
    </div>
  )
}

// ─── Edit/Create Modal ────────────────────────────────────────────────────────

function TemplateModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<SavedTemplate>
  onSave: (name: string, body: string, category: string) => void
  onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [body, setBody]         = useState(initial?.body ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'custom')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{initial?.id ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Sale Offer"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Message Body</label>
              <span className="text-xs text-slate-400">{body.length} chars</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Use <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{{shop_name}}'}</code>, etc. for dynamic values.
            </p>
            <textarea
              rows={7}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Hi {{name}}! ..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none font-mono"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">Cancel</button>
          <button
            onClick={() => { if (name.trim() && body.trim()) onSave(name.trim(), body.trim(), category) }}
            disabled={!name.trim() || !body.trim()}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
          >
            <Save className="w-4 h-4" /> Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [tab, setTab]               = useState<TabKey>('library')
  const [saved, setSaved]           = useState<SavedTemplate[]>([])
  const [loading, setLoading]       = useState(false)
  const [cloning, setCloning]       = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editTarget, setEditTarget] = useState<SavedTemplate | undefined>()
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadSaved = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSaved(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (tab === 'my_templates') loadSaved() }, [tab, loadSaved])

  async function cloneBuiltin(tmpl: BuiltinTemplate) {
    setCloning(tmpl.key)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCloning(null); return }

    const { error } = await supabase.from('templates').insert({
      user_id:  user.id,
      name:     `${tmpl.name} (copy)`,
      body:     tmpl.body,
      category: tmpl.category,
      variables: tmpl.variables,
      is_builtin: false,
    })

    setCloning(null)
    if (error) { showToast('Failed to clone template', false); return }
    showToast('Template cloned! Find it in My Templates.')
    setTab('my_templates')
    loadSaved()
  }

  async function saveTemplate(name: string, body: string, category: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const vars: string[] = []
    const varMatch = body.match(/\{\{(\w+)\}\}/g)
    if (varMatch) vars.push(...[...new Set(varMatch)])

    if (editTarget?.id) {
      const { error } = await supabase.from('templates').update({
        name, body, category, variables: vars, updated_at: new Date().toISOString(),
      }).eq('id', editTarget.id)
      if (error) { showToast('Failed to save', false); return }
      showToast('Template updated!')
    } else {
      const { error } = await supabase.from('templates').insert({
        user_id: user.id, name, body, category, variables: vars,
      })
      if (error) { showToast('Failed to save', false); return }
      showToast('Template saved!')
    }

    setShowModal(false)
    setEditTarget(undefined)
    loadSaved()
  }

  async function toggleFavorite(id: string, val: boolean) {
    await supabase.from('templates').update({ is_favorite: val }).eq('id', id)
    setSaved(prev => prev.map(t => t.id === id ? { ...t, is_favorite: val } : t))
  }

  async function toggleArchive(id: string, val: boolean) {
    await supabase.from('templates').update({ is_archived: val }).eq('id', id)
    setSaved(prev => prev.map(t => t.id === id ? { ...t, is_archived: val } : t))
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await supabase.from('templates').delete().eq('id', id)
    setSaved(prev => prev.filter(t => t.id !== id))
    showToast('Template deleted')
  }

  const filteredBuiltin = BUILTIN_TEMPLATES.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
  )

  const filteredSaved = saved.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
  )

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

      {/* Edit/Create modal */}
      {showModal && (
        <TemplateModal
          initial={editTarget}
          onSave={saveTemplate}
          onClose={() => { setShowModal(false); setEditTarget(undefined) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-500 text-sm mt-1">Clone built-in templates or create your own WhatsApp message templates</p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-green-500/20"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
        {(['library', 'my_templates'] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t === 'library' ? (
              <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Template Library ({BUILTIN_TEMPLATES.length})</span>
            ) : (
              <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> My Templates ({saved.filter(t => !t.is_archived).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white shadow-sm"
        />
      </div>

      {/* ── Library tab ──────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
            <Wand2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Ready-to-use WhatsApp templates</p>
              <p className="text-blue-700 text-xs mt-0.5">Click <strong>Clone & Edit</strong> to save a copy to My Templates, then customise it for your store.</p>
            </div>
          </div>

          {filteredBuiltin.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No templates match your search.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBuiltin.map(t => (
                <BuiltinCard key={t.key} tmpl={t} onClone={cloneBuiltin} cloning={cloning} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Templates tab ─────────────────────────────────────────────── */}
      {tab === 'my_templates' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
            </div>
          ) : filteredSaved.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="font-medium text-slate-700">{search ? 'No results' : 'No saved templates'}</p>
              <p className="text-slate-400 text-sm mt-1">
                {search ? 'Try a different search.' : 'Clone a built-in template or create your own.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => setTab('library')}
                  className="flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline"
                >
                  <Zap className="w-3.5 h-3.5" /> Browse library
                </button>
                <button
                  onClick={() => { setEditTarget(undefined); setShowModal(true) }}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-4 py-2 rounded-xl transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Create template
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSaved.map(t => (
                <SavedCard
                  key={t.id}
                  tmpl={t}
                  onFavorite={toggleFavorite}
                  onArchive={toggleArchive}
                  onDelete={deleteTemplate}
                  onEdit={tmpl => { setEditTarget(tmpl); setShowModal(true) }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

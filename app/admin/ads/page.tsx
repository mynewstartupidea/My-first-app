'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, Download, Mic, Loader2, Volume2, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Film, RefreshCw,
  Globe, User,
} from 'lucide-react'

/* ─── Canvas dimensions ───────────────────────────────────────────── */
const W = 1080, H = 1080
const DUR = 30

/* ─── Canvas helpers ─────────────────────────────────────────────── */
function eOut(t: number) { return 1 - Math.pow(1 - t, 3) }
function cl(t: number) { return Math.max(0, Math.min(1, t)) }
function pr(t: number, a: number, b: number) { return eOut(cl((t - a) / (b - a))) }

function txt(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  { size = 40, color = '#fff', weight = '700', alpha = 1, align = 'center' as CanvasTextAlign } = {}
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px -apple-system, "SF Pro Display", "Segoe UI", sans-serif`
  ctx.textAlign = align; ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function rr(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  fill: string, stroke?: string, sw = 1.5
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fillStyle = fill; ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke() }
}

function grid(ctx: CanvasRenderingContext2D, color = 'rgba(255,255,255,0.022)') {
  ctx.strokeStyle = color; ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, 'transparent')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

/* ─── Ad 1: Cart Recovery ─────────────────────────────────────────── */
function renderAd1(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, 0, W, H)
  grid(ctx)
  glow(ctx, 160, 200, 620, '239,68,68', 0.09 * cl(t / 1.5))
  glow(ctx, 920, 860, 520, '37,211,102', 0.07 * cl(t / 2))

  // S1: Problem 0–5s
  if (t < 5.5) {
    const f = t < .5 ? pr(t, 0, .5) : t > 4.5 ? 1 - pr(t, 4.5, 5.5) : 1
    ctx.globalAlpha = f * pr(t, .1, .8)
    rr(ctx, W / 2 - 215, 295, 430, 56, 28, 'rgba(239,68,68,.13)', 'rgba(239,68,68,.45)')
    ctx.beginPath(); ctx.arc(W / 2 - 158, 323, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'; ctx.fill()
    txt(ctx, 'HAPPENING RIGHT NOW', W / 2 + 16, 323, { size: 18, color: '#ef4444', weight: '800', alpha: f * pr(t, .1, .8) })
    txt(ctx, '70%', W / 2, 500, { size: Math.round(200 * pr(t, .3, 1.1)), color: '#ef4444', weight: '900', alpha: f * pr(t, .3, 1.1) })
    txt(ctx, 'of your carts are abandoned', W / 2, 618, { size: 34, color: '#94a3b8', weight: '400', alpha: f * pr(t, .9, 1.7) })
    const cards = [{ v: '₹4.2L', l: 'Lost Monthly' }, { v: '84%', l: 'No Follow-up' }, { v: '₹0', l: 'Recovered' }]
    cards.forEach((c, i) => {
      const cx = 200 + i * 295; ctx.globalAlpha = f * pr(t, 2, 3)
      rr(ctx, cx, 690, 260, 120, 18, 'rgba(239,68,68,.07)', 'rgba(239,68,68,.22)')
      txt(ctx, c.v, cx + 130, 735, { size: 44, color: '#ef4444', weight: '900', alpha: f * pr(t, 2, 3) })
      txt(ctx, c.l, cx + 130, 782, { size: 16, color: '#64748b', weight: '500', alpha: f * pr(t, 2, 3) })
    })
    ctx.globalAlpha = 1
  }

  // S2: Brand 5–9s
  if (t >= 4.5 && t < 9.5) {
    const lt = t - 4.5, f = lt < .6 ? pr(lt, 0, .6) : lt > 4.5 ? 1 - pr(lt, 4.5, 5) : 1
    const lp = pr(lt, 0, .8); ctx.globalAlpha = f * lp
    ctx.beginPath(); ctx.arc(W / 2, 380, 70 * lp, 0, Math.PI * 2); ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, 380, { size: 52, alpha: f * pr(lt, .4, 1) })
    txt(ctx, 'Wapaci', W / 2, 498, { size: 86, weight: '900', alpha: f * pr(lt, .5, 1.3) })
    txt(ctx, 'WhatsApp Revenue Automation', W / 2, 590, { size: 28, color: '#64748b', weight: '400', alpha: f * pr(lt, 1, 2) })
    const pills = ['Cart Recovery', 'COD Confirm', 'Order Updates']
    pills.forEach((p, i) => {
      const px = 160 + i * 295; ctx.globalAlpha = f * pr(lt, 1.5, 2.5)
      rr(ctx, px, 660, 260, 50, 25, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.35)')
      txt(ctx, p, px + 130, 685, { size: 18, color: '#25D366', weight: '700', alpha: f * pr(lt, 1.5, 2.5) })
    })
    ctx.globalAlpha = 1
  }

  // S3: WA Chat 9–22s
  if (t >= 8.5 && t < 22.5) {
    const lt = t - 8.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 13.3 ? 1 - pr(lt, 13.3, 14) : 1
    ctx.globalAlpha = f
    const pw = 440, ph = 700, px = (W - pw) / 2, py = 170
    rr(ctx, px, py, pw, ph, 44, '#111827', 'rgba(255,255,255,.1)', 2)
    rr(ctx, px, py, pw, 85, 44, '#075e54'); ctx.fillStyle = '#075e54'; ctx.fillRect(px, py + 44, pw, 41)
    ctx.beginPath(); ctx.arc(px + 44, py + 44, 26, 0, Math.PI * 2); ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, 'W', px + 44, py + 44, { size: 22, weight: '900' })
    txt(ctx, 'Wapaci Recovery', px + 84, py + 36, { size: 20, weight: '700', align: 'left' })
    txt(ctx, 'online', px + 84, py + 60, { size: 15, color: 'rgba(255,255,255,.7)', weight: '400', align: 'left' })
    ctx.fillStyle = '#0b1f0a'; ctx.fillRect(px, py + 85, pw, ph - 85)
    const msgs = [
      { side: 'out', lines: ['Hi Priya! 👋 You left', 'something behind...'], t0: .5 },
      { side: 'out', lines: ['Your cart:', '• Nike Air Max — ₹8,999', '• 2 more items 🛍️'], t0: 2.5 },
      { side: 'in',  lines: ['Oh yes! Was going to', 'buy that 😅'], t0: 5 },
      { side: 'out', lines: ['🎁 Here\'s 10% OFF!', 'Code: COMEBACK10'], t0: 7 },
      { side: 'in',  lines: ['✅ Order placed! Thanks!'], t0: 9.5 },
    ]
    let my = py + 105
    msgs.forEach(msg => {
      const mp = pr(lt, msg.t0, msg.t0 + .6); if (mp <= 0) return
      const bw = 350, lh = 26, bh = 24 + msg.lines.length * lh + 16
      const bx = msg.side === 'out' ? px + pw - bw - 14 : px + 14
      ctx.globalAlpha = f * mp
      rr(ctx, bx, my, bw, bh, 18, msg.side === 'out' ? '#005c4b' : '#1f2c34')
      msg.lines.forEach((line, li) => txt(ctx, line, bx + 14, my + 32 + li * lh, { size: 18, weight: '400', align: 'left' }))
      my += bh + 10
    })
    ctx.globalAlpha = 1
  }

  // S4: Stats 22–28s
  if (t >= 22 && t < 28.5) {
    const lt = t - 22, f = lt < .7 ? pr(lt, 0, .7) : lt > 5.5 ? 1 - pr(lt, 5.5, 6.5) : 1
    txt(ctx, 'REAL RESULTS', W / 2, 310, { size: 26, color: '#475569', weight: '700', alpha: f * pr(lt, 0, .8) })
    const stats = [{ v: '28%', l: 'Recovery Rate', s: 'vs 2% email' }, { v: '₹2.1L', l: 'Monthly Avg', s: 'per brand' }, { v: '47×', l: 'ROI', s: 'guaranteed' }]
    stats.forEach((s, i) => {
      const sp = pr(lt, .2 + i * .35, .9 + i * .35); ctx.globalAlpha = f * sp
      const cx = 150 + i * 300
      rr(ctx, cx, 370, 270, 210, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.2)')
      txt(ctx, s.v, cx + 135, 450, { size: 66, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + 135, 525, { size: 20, weight: '600', alpha: f * sp })
      txt(ctx, s.s, cx + 135, 556, { size: 16, color: '#64748b', weight: '400', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  // S5: CTA 28–30s
  if (t >= 27.5) {
    const lt = t - 27.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .15 * f)
    txt(ctx, 'Start Recovering', W / 2, 410, { size: 74, weight: '900', alpha: f })
    txt(ctx, 'Revenue Today', W / 2, 504, { size: 74, color: '#25D366', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .4, 1.1)
    rr(ctx, W / 2 - 210, 590, 420, 84, 42, '#25D366')
    txt(ctx, 'Try Wapaci Free →', W / 2, 632, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .4, 1.1) })
    txt(ctx, 'wapaci.com', W / 2, 726, { size: 24, color: '#64748b', weight: '400', alpha: f * pr(lt, .8, 1.5) })
    ctx.globalAlpha = 1
  }
}

/* ─── Ad 2: ROI Machine ───────────────────────────────────────────── */
function renderAd2(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#060d06'; ctx.fillRect(0, 0, W, H)
  grid(ctx, 'rgba(37,211,102,0.028)')
  glow(ctx, W / 2, H / 2, 700, '37,211,102', 0.07 * cl(t / 2))

  if (t < 6) {
    const f = t < .5 ? pr(t, 0, .5) : t > 5 ? 1 - pr(t, 5, 6) : 1
    txt(ctx, 'Revenue Recovered', W / 2, 340, { size: 32, color: '#475569', weight: '700', alpha: f * pr(t, 0, .8) })
    const val = Math.round(210000 * pr(t, .3, 4.5))
    txt(ctx, `₹${val.toLocaleString('en-IN')}`, W / 2, 490, { size: 96, color: '#25D366', weight: '900', alpha: f })
    txt(ctx, 'in 7 days • cart recovery', W / 2, 590, { size: 26, color: '#64748b', weight: '400', alpha: f * pr(t, 1, 2) })
    txt(ctx, '↑ from abandoned carts', W / 2, 660, { size: 22, color: '#22c55e', weight: '600', alpha: f * pr(t, 2.5, 3.5) })
    ctx.globalAlpha = 1
  }

  if (t >= 5.5 && t < 10.5) {
    const lt = t - 5.5, f = lt < .6 ? pr(lt, 0, .6) : lt > 4.5 ? 1 - pr(lt, 4.5, 5) : 1
    ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(W / 2, 380, 70 * pr(lt, 0, .8), 0, Math.PI * 2); ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, 380, { size: 52, alpha: f * pr(lt, .3, 1) })
    txt(ctx, 'Wapaci', W / 2, 496, { size: 86, weight: '900', alpha: f * pr(lt, .5, 1.3) })
    txt(ctx, 'ROI Machine', W / 2, 590, { size: 36, color: '#25D366', weight: '700', alpha: f * pr(lt, .9, 1.8) })
    ctx.globalAlpha = 1
  }

  if (t >= 9.5 && t < 22.5) {
    const lt = t - 9.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 12.3 ? 1 - pr(lt, 12.3, 13) : 1
    txt(ctx, 'THE MATH IS SIMPLE', W / 2, 230, { size: 24, color: '#334155', weight: '800', alpha: f * pr(lt, 0, .8) })
    const rows = [
      { label: '₹5L abandoned carts / month', color: '#ef4444', p: pr(lt, .4, 1.3) },
      { label: '× 28% WhatsApp recovery rate', color: '#f59e0b', p: pr(lt, 1.6, 2.6) },
      { label: '= ₹1.4L recovered monthly',   color: '#25D366', p: pr(lt, 3,   4.2) },
    ]
    rows.forEach((row, i) => {
      ctx.globalAlpha = f * row.p
      const ry = 310 + i * 130
      rr(ctx, 120, ry, W - 240, 100, 20, `${row.color}18`, `${row.color}45`)
      txt(ctx, row.label, W / 2, ry + 50, { size: 30, color: row.color, weight: '700', alpha: f * row.p })
    })
    const hp = pr(lt, 5, 6.5); ctx.globalAlpha = f * hp
    rr(ctx, 200, 720, 680, 160, 28, 'rgba(37,211,102,.12)', 'rgba(37,211,102,.4)', 2)
    txt(ctx, '47× ROI', W / 2, 778, { size: 72, color: '#25D366', weight: '900', alpha: f * hp })
    txt(ctx, 'on your marketing spend', W / 2, 845, { size: 22, color: '#64748b', weight: '400', alpha: f * hp })
    ctx.globalAlpha = 1
  }

  if (t >= 22 && t < 28.5) {
    const lt = t - 22, f = lt < .7 ? pr(lt, 0, .7) : lt > 5.5 ? 1 - pr(lt, 5.5, 6.5) : 1
    txt(ctx, 'WHY WHATSAPP WINS', W / 2, 300, { size: 26, color: '#334155', weight: '800', alpha: f * pr(lt, 0, .8) })
    const stats = [{ v: '98%', l: 'Open Rate' }, { v: '3 min', l: 'Avg Read Time' }, { v: '45%', l: 'Reply Rate' }]
    stats.forEach((s, i) => {
      const sp = pr(lt, .2 + i * .4, .9 + i * .4); ctx.globalAlpha = f * sp
      const cx = 130 + i * 300
      rr(ctx, cx, 360, 270, 240, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.22)')
      txt(ctx, s.v, cx + 135, 458, { size: 68, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + 135, 546, { size: 22, weight: '600', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  if (t >= 27.5) {
    const lt = t - 27.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .18 * f)
    txt(ctx, 'Your competitors are', W / 2, 380, { size: 52, weight: '700', alpha: f })
    txt(ctx, 'already doing this.', W / 2, 452, { size: 52, weight: '700', alpha: f })
    ctx.globalAlpha = f * pr(lt, .3, 1)
    rr(ctx, W / 2 - 220, 560, 440, 86, 43, '#25D366')
    txt(ctx, 'Start Free Trial →', W / 2, 603, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .3, 1) })
    txt(ctx, 'wapaci.com', W / 2, 700, { size: 24, color: '#64748b', weight: '400', alpha: f * pr(lt, .7, 1.5) })
    ctx.globalAlpha = 1
  }
}

/* ─── Ad 3: Channel Wars ──────────────────────────────────────────── */
function renderAd3(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H)
  grid(ctx)
  glow(ctx, 900, 200, 500, '59,130,246', 0.07 * cl(t / 2))
  glow(ctx, 200, 900, 500, '37,211,102', 0.06 * cl(t / 2))

  if (t < 6) {
    const f = t < .6 ? pr(t, 0, .6) : t > 5 ? 1 - pr(t, 5, 6) : 1
    txt(ctx, 'Quick question.', W / 2, 390, { size: 58, weight: '800', alpha: f * pr(t, 0, .9) })
    txt(ctx, 'Which channel do your', W / 2, 480, { size: 46, color: '#94a3b8', weight: '400', alpha: f * pr(t, .5, 1.5) })
    txt(ctx, 'customers actually read?', W / 2, 548, { size: 46, color: '#94a3b8', weight: '400', alpha: f * pr(t, .8, 1.8) })
    ctx.globalAlpha = 1
  }

  if (t >= 5.5 && t < 18.5) {
    const lt = t - 5.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 12.3 ? 1 - pr(lt, 12.3, 13) : 1
    const channels = [
      { label: 'Email',     pct: 2,  color: '#3b82f6', tD: .3 },
      { label: 'SMS',       pct: 5,  color: '#f59e0b', tD: 1.8 },
      { label: 'WhatsApp',  pct: 98, color: '#25D366', tD: 3.5 },
    ]
    const barMaxH = 420, barW = 200, gap = 100, baseY = 820
    const totalW = channels.length * barW + (channels.length - 1) * gap
    const startX = (W - totalW) / 2
    channels.forEach((ch, i) => {
      const cp = pr(lt, ch.tD, ch.tD + 2.5), barH = barMaxH * (ch.pct / 100) * cp
      const bx = startX + i * (barW + gap), by = baseY - barH
      ctx.globalAlpha = f * Math.min(1, cp * 2)
      rr(ctx, bx, by, barW, barH + 4, 12, ch.color + '30', ch.color + '80')
      if (ch.pct === 98 && cp > .5) {
        const gg = ctx.createLinearGradient(bx, by, bx, by + barH)
        gg.addColorStop(0, ch.color + 'bb'); gg.addColorStop(1, ch.color + '22')
        ctx.fillStyle = gg; ctx.fill()
      }
      txt(ctx, `${Math.round(ch.pct * cp)}%`, bx + barW / 2, by - 34, { size: ch.pct === 98 ? 52 : 38, color: ch.color, weight: '900', alpha: f * cp })
      txt(ctx, ch.label, bx + barW / 2, baseY + 44, { size: 22, weight: '700', alpha: f * Math.min(1, cp * 2) })
    })
    txt(ctx, 'Open Rate', W / 2, 240, { size: 26, color: '#334155', weight: '800', alpha: f * pr(lt, 6, 7.5) })
    ctx.globalAlpha = 1
  }

  if (t >= 17.5 && t < 26.5) {
    const lt = t - 17.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 8.3 ? 1 - pr(lt, 8.3, 9) : 1
    txt(ctx, 'Why WhatsApp wins', W / 2, 270, { size: 40, color: '#94a3b8', weight: '700', alpha: f * pr(lt, 0, .9) })
    const stats = [
      { icon: '📬', v: '98%',   l: 'Open Rate',  s: 'vs 2% email' },
      { icon: '⚡',  v: '3 min', l: 'Read Time',  s: 'avg response' },
      { icon: '💬', v: '45%',   l: 'Reply Rate', s: 'real engagement' },
    ]
    stats.forEach((s, i) => {
      const sp = pr(lt, .3 + i * .4, 1.1 + i * .4); ctx.globalAlpha = f * sp
      const cx = 130 + i * 300, cw = 265
      rr(ctx, cx, 340, cw, 270, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.2)')
      txt(ctx, s.icon, cx + cw / 2, 395, { size: 44, alpha: f * sp })
      txt(ctx, s.v, cx + cw / 2, 467, { size: 56, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + cw / 2, 527, { size: 20, weight: '700', alpha: f * sp })
      txt(ctx, s.s, cx + cw / 2, 558, { size: 15, color: '#64748b', weight: '400', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  if (t >= 25.5) {
    const lt = t - 25.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .15 * f)
    txt(ctx, 'Your customers are on WhatsApp.', W / 2, 370, { size: 42, weight: '800', alpha: f })
    txt(ctx, 'Your brand should be too.', W / 2, 442, { size: 42, color: '#25D366', weight: '800', alpha: f })
    ctx.globalAlpha = f * pr(lt, .4, 1.1)
    rr(ctx, W / 2 - 220, 560, 440, 86, 43, '#25D366')
    txt(ctx, 'Try Wapaci Free →', W / 2, 603, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .4, 1.1) })
    txt(ctx, 'wapaci.com', W / 2, 702, { size: 24, color: '#64748b', weight: '400', alpha: f * pr(lt, .8, 1.5) })
    ctx.globalAlpha = 1
  }
}

const RENDERERS: Record<number, (ctx: CanvasRenderingContext2D, t: number) => void> = {
  1: renderAd1, 2: renderAd2, 3: renderAd3,
}

/* ─── Ad definitions ──────────────────────────────────────────────── */
// NOTE: "Wapakee" is the phonetic spelling to get correct pronunciation.
// The brand name in UI stays "Wapaci" — only the TTS script uses the phonetic form.
const ADS = [
  {
    id: 1, filename: 'wapaci-cart-recovery',
    title: 'Cart Recovery — PAS Formula',
    tag: 'Cold Traffic', tagColor: 'bg-red-500/20 text-red-400 border-red-500/30',
    accent: '#ef4444',
    defaultScript: `Right now...

Seventy percent of your customers... are leaving.

Without buying.

That's real money. Walking out the door. Every. Single. Day.

And you have... absolutely no way to bring them back.

Until now.

Wapakee sends them a WhatsApp message — automatically. At exactly the right moment.

And here's what happens next?

Twenty-eight percent... come back!

Twenty-eight percent of your abandoned carts — recovered. Every month. On autopilot.

Your competitors are already doing this.

Don't get left behind.

Try Wapakee free today — wapaci dot com!`,
    voiceDir: 'serious and slow dramatic opening with heavy pauses, build suspense, then suddenly shift to excited and energetic when revealing the solution, warm and enthusiastic close',
  },
  {
    id: 2, filename: 'wapaci-roi-machine',
    title: 'ROI Machine — Outcome First',
    tag: 'Warm Traffic', tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    accent: '#25D366',
    defaultScript: `What... if I told you...

Five lakh rupees of abandoned carts...

Could become... one point four lakh... in recovered revenue?

That's not a pitch. That's the math.

WhatsApp messages get a...

Ninety-eight percent open rate.

Nine. Eight. Percent.

Read in under three minutes. Forty-five percent of customers... actually reply back.

That's forty-seven times your investment. Every. Single. Month.

The math is simple. The setup? Ten minutes.

Your competitors are already using this.

The results speak for themselves.

Start your free trial at Wapakee dot com — today!`,
    voiceDir: 'confident and curious opening, slow down on numbers so they land with weight, conversational warmth in the middle, build to high energy close, like a passionate founder sharing a breakthrough',
  },
  {
    id: 3, filename: 'wapaci-channel-wars',
    title: 'Channel Wars — Comparison',
    tag: 'Consideration', tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    accent: '#3b82f6',
    defaultScript: `Quick question.

Which channel... do your customers actually read?

Email?

Two percent open rate. ...

SMS?

Five percent. ...

WhatsApp?

Ninety. Eight. Percent!

Let that sink in.

Your customers are on WhatsApp. They read messages in under three minutes. And almost half of them... reply!

Stop sending emails nobody opens.

Start sending WhatsApp messages that actually convert.

Wapakee — WhatsApp automation for Indian D2C brands.

Try it free today — wapaci dot com!`,
    voiceDir: 'start very slow and deliberate, long dramatic silence between each stat, explosive excitement on the WhatsApp reveal, thoughtful pause then warm confident close',
  },
]

/* ─── Types ────────────────────────────────────────────────────────── */
type Lang   = 'english' | 'hindi' | 'auto'
type Gender = 'male' | 'female'

type VoiceState = {
  script:        string
  lang:          Lang
  gender:        Gender
  customDir:     string
  status:        'idle' | 'generating' | 'ready' | 'error'
  audioBlob:     Blob | null
  audioUrl:      string | null
  error:         string | null
}

// Per-ad silent download state (no modal — purely inline)
type DlState = {
  adId:        number | null
  secondsLeft: number
  done:        boolean
}

/* ─── Strip [tone] tags — only used with Muga; Mulberry ignores them or reads them literally ── */
function stripToneTags(text: string): string {
  return text
    .replace(/\[(serious|excited|emotional|happy|conversational|sad|angry|calm)\]\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ─── Build description sent to Rumik Mulberry ─────────────────────── */
function buildDesc(ad: typeof ADS[0], v: VoiceState): { description: string; language?: string } {
  const gPart = v.gender === 'male'
    ? 'deep clear Indian male voice speaking in English'
    : 'warm clear Indian female voice speaking in English'
  const lPart = v.lang === 'english'
    ? 'speak only in English'
    : v.lang === 'hindi'
    ? 'speak only in Hindi, natural Indian accent'
    : 'speak in the same language as the script'
  const parts = [gPart, lPart, ad.voiceDir, v.customDir.trim()].filter(Boolean)
  return {
    description: parts.join(', '),
    language:    v.lang === 'english' ? 'en' : v.lang === 'hindi' ? 'hi' : undefined,
  }
}

/* ─── Main component ──────────────────────────────────────────────── */
export default function AdminAdsPage() {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [voices, setVoices] = useState<Record<number, VoiceState>>(
    Object.fromEntries(ADS.map(ad => [ad.id, {
      script:    ad.defaultScript,
      lang:      'english' as Lang,
      gender:    'male'    as Gender,
      customDir: '',
      status:    'idle'    as const,
      audioBlob: null,
      audioUrl:  null,
      error:     null,
    }]))
  )
  const [dl, setDl] = useState<DlState>({ adId: null, secondsLeft: 30, done: false })

  // Two canvas refs per ad: preview (visible in card) and record (offscreen, always mounted)
  const previewRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const recordRefs  = useRef<Record<number, HTMLCanvasElement | null>>({})
  const recMrRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef      = useRef<number>(0)

  function setVo(id: number, patch: Partial<VoiceState>) {
    setVoices(p => ({ ...p, [id]: { ...p[id], ...patch } }))
  }

  /* ── Generate voiceover ── */
  async function generate(ad: typeof ADS[0]) {
    const v = voices[ad.id]
    if (v.audioUrl) URL.revokeObjectURL(v.audioUrl)
    setVo(ad.id, { status: 'generating', error: null, audioBlob: null, audioUrl: null })
    try {
      const { description, language } = buildDesc(ad, v)
      // mulberry = Rumik's natural-language model, supports English
      // Strip [tone] tags — those are Muga-only markers that cause mulberry to speak Hindi
      const cleanText = stripToneTags(v.script)
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mulberry', text: cleanText, description, language }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Generation failed')
      }
      const blob = await res.blob()
      setVo(ad.id, { status: 'ready', audioBlob: blob, audioUrl: URL.createObjectURL(blob) })
    } catch (e: unknown) {
      setVo(ad.id, { status: 'error', error: e instanceof Error ? e.message : 'Error' })
    }
  }

  /* ── Canvas + Web Audio recording — no modal, no screen share ── */
  const downloadVideo = useCallback(async (ad: typeof ADS[0]) => {
    if (dl.adId !== null) return // already encoding something

    // Offscreen 1080×1080 canvas — always mounted, never in the DOM visible flow
    const recordCanvas = recordRefs.current[ad.id]
    if (!recordCanvas) { alert('Canvas not ready — please refresh and try again.'); return }

    const v = voices[ad.id]
    setDl({ adId: ad.id, secondsLeft: 30, done: false })
    chunksRef.current = []

    /* ── Web Audio ── */
    const audioCtx  = new AudioContext()
    const audioDest = audioCtx.createMediaStreamDestination()
    const master    = audioCtx.createGain(); master.gain.value = 0.9
    master.connect(audioDest); master.connect(audioCtx.destination)

    if (v.audioBlob) {
      try {
        const buf = await audioCtx.decodeAudioData(await v.audioBlob.arrayBuffer())
        const src = audioCtx.createBufferSource(); src.buffer = buf
        const vg  = audioCtx.createGain(); vg.gain.value = 1.15
        src.connect(vg); vg.connect(master)
        src.start(audioCtx.currentTime + 0.15)
      } catch (e) { console.warn('voiceover decode:', e) }
    }

    // Ambient chord pad (very subtle)
    ;[131, 165, 196, 262].forEach(f => {
      const osc = audioCtx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f
      const g   = audioCtx.createGain()
      g.gain.setValueAtTime(0, audioCtx.currentTime)
      g.gain.linearRampToValueAtTime(0.018, audioCtx.currentTime + 2.5)
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + DUR - 2)
      osc.connect(g); g.connect(master); osc.start()
    })

    /* ── MediaRecorder from offscreen canvas stream ── */
    const videoStream = recordCanvas.captureStream(30)
    const combined    = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ])

    // Best codec order: H.264 mp4 (sharpest on mobile) → VP9 webm → plain webm
    const mime = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

    const recorder = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: 20_000_000, // 20 Mbps → sharp 1080p on phone
    })
    recMrRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    recorder.onstop = () => {
      audioCtx.close()
      if (timerRef.current) clearInterval(timerRef.current)
      cancelAnimationFrame(rafRef.current)

      // Build blob and trigger browser download — no tab opens
      const blob = new Blob(chunksRef.current, { type: mime })
      const url  = URL.createObjectURL(blob)
      const ext  = mime.includes('mp4') ? 'mp4' : 'webm'
      const a    = document.createElement('a')
      a.href = url; a.download = `${ad.filename}.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      setDl({ adId: null, secondsLeft: 30, done: true })
      setTimeout(() => setDl(d => ({ ...d, done: false })), 5000)
    }

    recorder.start(100) // collect a chunk every 100 ms

    // Countdown timer — drives the inline progress in the button
    let secs = DUR
    timerRef.current = setInterval(() => {
      secs--
      setDl(d => ({ ...d, secondsLeft: secs }))
      if (secs <= 0) { clearInterval(timerRef.current!); recorder.stop() }
    }, 1000)

    // Frame loop — renders to the offscreen canvas (captureStream picks it up automatically)
    const renderer = RENDERERS[ad.id]
    const rCtx     = recordCanvas.getContext('2d')!
    const startMs  = performance.now()

    function frame() {
      const t = (performance.now() - startMs) / 1000
      renderer(rCtx, t)
      if (t < DUR + 0.5) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [voices, dl.adId])

  function cancelDl() {
    if (recMrRef.current?.state !== 'inactive') recMrRef.current?.stop()
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setDl({ adId: null, secondsLeft: 30, done: false })
  }

  // Preview animation loop for all cards
  useEffect(() => {
    const handles: Record<number, number> = {}
    ADS.forEach(ad => {
      const canvas = previewRefs.current[ad.id]
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const s = performance.now()
      const loop = () => {
        RENDERERS[ad.id](ctx, ((performance.now() - s) / 1000) % DUR)
        handles[ad.id] = requestAnimationFrame(loop)
      }
      handles[ad.id] = requestAnimationFrame(loop)
    })
    return () => Object.values(handles).forEach(h => cancelAnimationFrame(h))
  }, [])

  useEffect(() => () => cancelDl(), [])

  return (
    <div className="min-h-screen bg-[#070b12] text-white">

      {/* ── Offscreen recording canvases — at -9999px, captureStream picks them up ── */}
      <div aria-hidden style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', opacity: 0 }}>
        {ADS.map(ad => (
          <canvas
            key={ad.id}
            ref={el => { recordRefs.current[ad.id] = el }}
            width={1080} height={1080}
          />
        ))}
      </div>

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
              <p className="text-slate-500 text-xs mt-0.5">Canvas · 20Mbps · no screen share · direct MP4</p>
            </div>
          </div>
        </div>
        {dl.done && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-semibold">Downloaded successfully!</span>
          </div>
        )}
        {dl.adId !== null && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <Loader2 size={13} className="text-purple-400 animate-spin" />
            <span className="text-slate-300 text-sm">Encoding video… <span className="font-bold tabular-nums text-white">{dl.secondsLeft}s</span></span>
            <div className="w-24 bg-white/10 rounded-full h-1">
              <div className="bg-purple-500 h-1 rounded-full transition-all" style={{ width: `${((DUR - dl.secondsLeft) / DUR) * 100}%` }} />
            </div>
            <button onClick={cancelDl} className="text-slate-600 hover:text-red-400 text-xs transition">✕</button>
          </div>
        )}
      </div>

      {/* ── Ad cards ── */}
      <div className="px-8 py-6 space-y-6">
        {ADS.map(ad => {
          const v       = voices[ad.id]
          const isEx    = expanded === ad.id
          const isEncoding = dl.adId === ad.id

          return (
            <div key={ad.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex">

                {/* Preview canvas thumbnail — always visible */}
                <div className="flex-shrink-0 relative bg-black overflow-hidden" style={{ width: 200, height: 200 }}>
                  <canvas
                    ref={el => { previewRefs.current[ad.id] = el }}
                    width={1080} height={1080}
                    style={{ width: 200, height: 200, display: 'block' }}
                  />
                  {isEncoding && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5">
                      <Loader2 size={20} className="text-purple-400 animate-spin" />
                      <span className="text-white text-xs font-bold tabular-nums">{dl.secondsLeft}s</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ad.tagColor}`}>{ad.tag}</span>
                  </div>
                </div>

                {/* Info + actions */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-white font-bold text-base">{ad.title}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">1080×1080 · 20Mbps · 30fps · canvas encode</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => downloadVideo(ad)}
                      disabled={dl.adId !== null}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: ad.accent + '25', color: ad.accent, border: `1px solid ${ad.accent}50` }}
                    >
                      {isEncoding
                        ? <><Loader2 size={13} className="animate-spin" /> Encoding {dl.secondsLeft}s…</>
                        : <><Download size={13} /> {v.status === 'ready' ? 'Download with Voiceover' : 'Download MP4'}</>
                      }
                    </button>

                    <button
                      onClick={() => setExpanded(isEx ? null : ad.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                        v.status === 'ready'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic size={12} />
                      {v.status === 'ready' ? '✓ Voiceover Ready' : 'Add Voiceover'}
                      {isEx ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Voiceover panel ── */}
              {isEx && (
                <div className="border-t border-white/[0.06] bg-black/20 p-5">
                  <div className="grid grid-cols-5 gap-5">

                    {/* Script — 3 cols */}
                    <div className="col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Script</label>
                        <button onClick={() => setVo(ad.id, { script: ad.defaultScript })} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition">
                          <RefreshCw size={9} /> Reset
                        </button>
                      </div>
                      <textarea
                        rows={10}
                        value={v.script}
                        onChange={e => setVo(ad.id, { script: e.target.value })}
                        className="w-full text-sm text-slate-200 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono leading-relaxed"
                      />
                      <p className="text-slate-600 text-[10px] mt-1.5">
                        Write plain English · Use <code className="text-slate-500">...</code> for pauses · Short sentences on separate lines = natural rhythm · Tone is controlled by Voice Direction below
                      </p>
                    </div>

                    {/* Controls — 2 cols */}
                    <div className="col-span-2 space-y-3">

                      {/* Language */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          <Globe size={11} /> Language
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['english', 'hindi', 'auto'] as Lang[]).map(l => (
                            <button key={l} onClick={() => setVo(ad.id, { lang: l })}
                              className={`py-1.5 rounded-lg text-xs font-bold border capitalize transition ${
                                v.lang === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-blue-500/40'
                              }`}>{l === 'auto' ? 'Auto' : l === 'english' ? 'English' : 'Hindi'}</button>
                          ))}
                        </div>
                        {v.lang === 'hindi' && (
                          <p className="text-amber-500/80 text-[10px] mt-1">Write your script in Hindi/Devanagari for Hindi voiceover</p>
                        )}
                      </div>

                      {/* Gender */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          <User size={11} /> Voice Gender
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['male', 'female'] as Gender[]).map(g => (
                            <button key={g} onClick={() => setVo(ad.id, { gender: g })}
                              className={`py-1.5 rounded-lg text-xs font-bold border capitalize transition ${
                                v.gender === g ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-purple-500/40'
                              }`}>{g === 'male' ? '🎙 Male' : '🎤 Female'}</button>
                          ))}
                        </div>
                      </div>

                      {/* Custom voice direction */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Custom Voice Direction</label>
                        <textarea
                          rows={3}
                          value={v.customDir}
                          onChange={e => setVo(ad.id, { customDir: e.target.value })}
                          placeholder="e.g. speak faster, more urgent, emphasize the numbers..."
                          className="w-full text-xs text-slate-300 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-slate-700"
                        />
                      </div>

                      {/* Generate */}
                      <button
                        onClick={() => generate(ad)}
                        disabled={v.status === 'generating' || !v.script.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition"
                      >
                        {v.status === 'generating'
                          ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                          : <><Sparkles size={14} /> Generate Voiceover</>}
                      </button>

                      {v.status === 'error' && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-red-400 text-xs">{v.error}</p>
                        </div>
                      )}

                      {v.status === 'ready' && v.audioUrl && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Volume2 size={13} className="text-purple-400" />
                            <span className="text-purple-300 text-xs font-semibold">Preview</span>
                            <CheckCircle2 size={12} className="text-green-400 ml-auto" />
                          </div>
                          <audio src={v.audioUrl} controls className="w-full" style={{ height: 32 }} />
                          <button
                            onClick={() => downloadVideo(ad)}
                            disabled={dl.adId !== null}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                          >
                            {isEncoding
                              ? <><Loader2 size={12} className="animate-spin" /> Encoding {dl.secondsLeft}s…</>
                              : <><Download size={12} /> Download Video with Voiceover</>
                            }
                          </button>
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

      <div className="px-8 pb-10">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 text-center">
          <p className="text-slate-700 text-xs">Canvas renders at 1080×1080 · 30fps · 20Mbps H.264 · Audio mixed via Web Audio API · No screen share ever required</p>
        </div>
      </div>
    </div>
  )
}

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

/* ─── Creative helpers ────────────────────────────────────────────── */
function ghost(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, a: number) {
  ctx.save(); ctx.globalAlpha = a
  ctx.beginPath(); ctx.arc(x, y - sz * .2, sz * .48, Math.PI, 0)
  ctx.lineTo(x + sz * .48, y + sz * .55)
  for (let i = 4; i > 0; i--) {
    const bx = x + sz * .48 - (4 - i) * sz * .24
    ctx.quadraticCurveTo(bx - sz * .12, y + sz * .7, bx - sz * .24, y + sz * .55)
  }
  ctx.closePath(); ctx.fillStyle = 'rgba(203,213,225,.92)'; ctx.fill()
  ctx.fillStyle = '#0f172a'
  ;[[-0.15, -0.15], [0.15, -0.15]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.arc(x + sz * dx, y + sz * dy, sz * .08, 0, Math.PI * 2); ctx.fill()
  }); ctx.restore()
}

function starfield(ctx: CanvasRenderingContext2D, n: number, t: number) {
  ctx.save()
  for (let i = 0; i < n; i++) {
    const bx = Math.abs(Math.sin(i * 127.3)) * W, by = Math.abs(Math.sin(i * 311.7)) * H
    const br = .5 + Math.abs(Math.sin(i * 47.1)) * 1.5
    ctx.globalAlpha = .3 + .5 * Math.abs(Math.sin(t * 1.5 + i))
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
  }; ctx.restore()
}

function rocketDraw(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, a: number, t: number) {
  ctx.save(); ctx.globalAlpha = a
  ctx.beginPath(); ctx.moveTo(x, y - sz)
  ctx.bezierCurveTo(x + sz * .55, y - sz * .3, x + sz * .45, y + sz * .4, x + sz * .38, y + sz * .5)
  ctx.lineTo(x - sz * .38, y + sz * .5)
  ctx.bezierCurveTo(x - sz * .45, y + sz * .4, x - sz * .55, y - sz * .3, x, y - sz)
  ctx.fillStyle = '#f97316'; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y - sz * .15, sz * .2, 0, Math.PI * 2); ctx.fillStyle = '#bfdbfe'; ctx.fill()
  ;[-1, 1].forEach(d => {
    ctx.beginPath(); ctx.moveTo(x + d * sz * .38, y + sz * .2)
    ctx.lineTo(x + d * sz * .8, y + sz * .65); ctx.lineTo(x + d * sz * .38, y + sz * .5)
    ctx.fillStyle = '#dc2626'; ctx.fill()
  })
  const fl = sz * .55 + Math.sin(t * 20) * sz * .12
  ctx.beginPath(); ctx.moveTo(x - sz * .28, y + sz * .5)
  ctx.quadraticCurveTo(x, y + sz * .5 + fl, x + sz * .28, y + sz * .5)
  ctx.fillStyle = '#fbbf24'; ctx.fill(); ctx.restore()
}

function burst(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, s: number, color: string, n = 28) {
  if (t < s) return; const lt = t - s; ctx.save()
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2, spd = 60 + Math.abs(Math.sin(i * 5.3)) * 80
    const x = cx + Math.cos(ang) * spd * lt, y = cy + Math.sin(ang) * spd * lt + 180 * lt * lt
    ctx.globalAlpha = Math.max(0, 1 - lt * 1.6)
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4 + Math.abs(Math.sin(i * 2.1)) * 2.5, 0, Math.PI * 2); ctx.fill()
  }; ctx.restore()
}

/* ─── Music helpers ───────────────────────────────────────────────── */
function pad(audioCtx: AudioContext, master: GainNode, freqs: number[], wave: OscillatorType, gain: number, fin = 2.5, fout = DUR - 2) {
  freqs.forEach(f => { try {
    const osc = audioCtx.createOscillator(); osc.type = wave; osc.frequency.value = f
    const g = audioCtx.createGain()
    g.gain.setValueAtTime(0, audioCtx.currentTime)
    g.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + fin)
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fout)
    osc.connect(g); g.connect(master); osc.start(); osc.stop(audioCtx.currentTime + DUR)
  } catch {} })
}

function arpNote(audioCtx: AudioContext | OfflineAudioContext, master: GainNode, freqs: number[], ms: number, wave: OscillatorType, gain: number, delay = 0) {
  const count = Math.floor((DUR - delay) * 1000 / ms)
  for (let i = 0; i < count; i++) {
    const at = audioCtx.currentTime + delay + i * (ms / 1000)
    if (at >= audioCtx.currentTime + DUR) break
    try {
      const osc = audioCtx.createOscillator(); osc.type = wave; osc.frequency.value = freqs[i % freqs.length]
      const g = audioCtx.createGain()
      g.gain.setValueAtTime(gain, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000 * 0.75)
      osc.connect(g); g.connect(master); osc.start(at); osc.stop(at + ms / 1000 + 0.05)
    } catch {}
  }
}

function tone(audioCtx: AudioContext, master: GainNode, at: number, freq: number, dur: number, gain: number, wave: OscillatorType = 'sine', endFreq?: number) {
  try {
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, at)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur * .85)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(gain, at + .015)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g); g.connect(master)
    osc.start(at); osc.stop(at + dur + .08)
  } catch {}
}

function noise(audioCtx: AudioContext, master: GainNode, at: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = .8) {
  try {
    const len = Math.ceil(audioCtx.sampleRate * dur)
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4)
    const src = audioCtx.createBufferSource()
    const f = audioCtx.createBiquadFilter()
    const g = audioCtx.createGain()
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(f); f.connect(g); g.connect(master)
    src.start(at); src.stop(at + dur + .05)
  } catch {}
}

function hit(audioCtx: AudioContext, master: GainNode, at: number, color: 'green' | 'orange' | 'red' | 'blue' = 'green') {
  const root = color === 'orange' ? 110 : color === 'red' ? 82 : color === 'blue' ? 98 : 130
  tone(audioCtx, master, at, root, .42, .18, 'triangle', root / 2)
  tone(audioCtx, master, at + .02, root * 2, .18, .08, 'sine')
  noise(audioCtx, master, at, .26, .12, 'lowpass', 900)
}

function whooshFx(audioCtx: AudioContext, master: GainNode, at: number) {
  noise(audioCtx, master, at, .52, .18, 'bandpass', 1800, .6)
  tone(audioCtx, master, at + .03, 180, .5, .08, 'sine', 900)
}

function waPing(audioCtx: AudioContext, master: GainNode, at: number) {
  tone(audioCtx, master, at, 880, .11, .18, 'sine')
  tone(audioCtx, master, at + .09, 1320, .18, .15, 'sine')
}

function cashFx(audioCtx: AudioContext, master: GainNode, at: number) {
  tone(audioCtx, master, at, 1480, .09, .18, 'sine', 740)
  tone(audioCtx, master, at + .08, 1180, .18, .14, 'sine', 590)
  tone(audioCtx, master, at + .2, 1760, .22, .12, 'triangle')
}

function ticker(audioCtx: AudioContext, master: GainNode, at: number, count: number, step = .18) {
  for (let i = 0; i < count; i++) tone(audioCtx, master, at + i * step, 680 + i * 28, .055, .045, 'square')
}

function scheduleAdAudio(audioCtx: AudioContext, master: GainNode, adId: number) {
  const now = audioCtx.currentTime
  switch (adId) {
    case 4: // Dead Hours — dark minor, eerie midnight
      pad(audioCtx, master, [82, 98, 123, 164], 'sawtooth', .012, 2, 29)
      arpNote(audioCtx, master, [164, 196, 220, 247, 196], 420, 'triangle', .020, 4)
      hit(audioCtx, master, now + .3, 'blue')
      tone(audioCtx, master, now + 3.5, 80, .8, .08, 'sine')
      whooshFx(audioCtx, master, now + 8.2)
      hit(audioCtx, master, now + 12.1, 'blue')
      waPing(audioCtx, master, now + 15.8)
      hit(audioCtx, master, now + 20.5, 'green')
      cashFx(audioCtx, master, now + 24.2)
      hit(audioCtx, master, now + 27.5, 'green'); cashFx(audioCtx, master, now + 29)
      break
    case 5: // 98% Club — triumphant ascending
      pad(audioCtx, master, [131, 165, 196, 262], 'sine', .016, 1.5, 28)
      arpNote(audioCtx, master, [262, 330, 392, 494, 587], 240, 'sine', .024, 3)
      hit(audioCtx, master, now + .4, 'green')
      ticker(audioCtx, master, now + 2, 9)
      whooshFx(audioCtx, master, now + 6.5); hit(audioCtx, master, now + 7, 'green')
      cashFx(audioCtx, master, now + 10.5)
      ticker(audioCtx, master, now + 14, 12, .14)
      cashFx(audioCtx, master, now + 18.5); hit(audioCtx, master, now + 22, 'green')
      cashFx(audioCtx, master, now + 26.5); hit(audioCtx, master, now + 28.8, 'green')
      break
    case 6: // COD Recovery — urgent, punchy orange
      pad(audioCtx, master, [110, 138, 165, 220], 'sawtooth', .014, 1.8, 28)
      arpNote(audioCtx, master, [220, 277, 330, 440], 300, 'square', .018, 5)
      hit(audioCtx, master, now + .25, 'orange'); hit(audioCtx, master, now + 1.8, 'red')
      whooshFx(audioCtx, master, now + 5.5)
      hit(audioCtx, master, now + 9.2, 'orange'); hit(audioCtx, master, now + 13.5, 'red')
      waPing(audioCtx, master, now + 16.4)
      hit(audioCtx, master, now + 19.1, 'green'); cashFx(audioCtx, master, now + 22.3)
      ticker(audioCtx, master, now + 25, 8, .15); hit(audioCtx, master, now + 28.5, 'green')
      break
    case 7: // Ghost Customers — playful, whimsical purple
      pad(audioCtx, master, [196, 247, 294, 392], 'triangle', .016, 2, 27)
      arpNote(audioCtx, master, [392, 440, 494, 587, 659, 784], 200, 'sine', .022, 4)
      tone(audioCtx, master, now + .5, 880, .15, .12, 'triangle')
      tone(audioCtx, master, now + 1.2, 1047, .12, .1, 'triangle')
      whooshFx(audioCtx, master, now + 4.5)
      hit(audioCtx, master, now + 8, 'blue')
      tone(audioCtx, master, now + 11, 988, .18, .14, 'triangle')
      hit(audioCtx, master, now + 15.5, 'green')
      waPing(audioCtx, master, now + 19.3)
      cashFx(audioCtx, master, now + 23.1); hit(audioCtx, master, now + 27, 'green')
      break
    case 8: // Leaky Bucket — descending drip feel
      pad(audioCtx, master, [73, 98, 110, 147], 'triangle', .015, 2, 28)
      arpNote(audioCtx, master, [220, 196, 175, 156, 131], 380, 'sine', .020, 3)
      tone(audioCtx, master, now + .6, 440, .25, .09, 'sine', 220)
      tone(audioCtx, master, now + 2.4, 440, .25, .08, 'sine', 220)
      tone(audioCtx, master, now + 4.1, 440, .25, .08, 'sine', 220)
      hit(audioCtx, master, now + 6.5, 'red')
      whooshFx(audioCtx, master, now + 10.2); hit(audioCtx, master, now + 14.5, 'blue')
      waPing(audioCtx, master, now + 18.2)
      cashFx(audioCtx, master, now + 22.4)
      ticker(audioCtx, master, now + 25.5, 7, .16); hit(audioCtx, master, now + 28.5, 'green')
      break
    case 9: // Flash Sale Blast — explosive, high energy
      pad(audioCtx, master, [165, 220, 277, 330], 'sawtooth', .014, 1, 28)
      arpNote(audioCtx, master, [440, 554, 659, 880, 988], 160, 'square', .020, 2)
      hit(audioCtx, master, now + .2, 'red'); hit(audioCtx, master, now + .8, 'orange')
      ticker(audioCtx, master, now + 2, 16, .1)
      whooshFx(audioCtx, master, now + 5.5); cashFx(audioCtx, master, now + 7)
      hit(audioCtx, master, now + 10.5, 'red')
      ticker(audioCtx, master, now + 14, 10, .12)
      cashFx(audioCtx, master, now + 17.5); hit(audioCtx, master, now + 21, 'green')
      cashFx(audioCtx, master, now + 24.3)
      ticker(audioCtx, master, now + 26.5, 10, .1); hit(audioCtx, master, now + 29, 'green')
      break
    case 10: // Order Delight — gentle journey teal
      pad(audioCtx, master, [174, 220, 261, 349], 'sine', .018, 2, 28)
      arpNote(audioCtx, master, [349, 440, 523, 659, 784], 320, 'sine', .020, 5)
      waPing(audioCtx, master, now + 1.5); hit(audioCtx, master, now + 4, 'green')
      waPing(audioCtx, master, now + 7.5); hit(audioCtx, master, now + 11, 'green')
      waPing(audioCtx, master, now + 14.5); cashFx(audioCtx, master, now + 18)
      hit(audioCtx, master, now + 22, 'green')
      waPing(audioCtx, master, now + 25.5); cashFx(audioCtx, master, now + 28)
      break
    case 11: // Win-Back — nostalgic, emotional cyan
      pad(audioCtx, master, [131, 165, 196, 247], 'triangle', .016, 2.5, 27)
      arpNote(audioCtx, master, [196, 247, 294, 370, 494], 360, 'triangle', .022, 6)
      tone(audioCtx, master, now + 1, 392, .4, .14, 'triangle', 196)
      hit(audioCtx, master, now + 5.5, 'blue')
      whooshFx(audioCtx, master, now + 10); hit(audioCtx, master, now + 14.5, 'blue')
      waPing(audioCtx, master, now + 18.5); cashFx(audioCtx, master, now + 22.5)
      hit(audioCtx, master, now + 26, 'green'); cashFx(audioCtx, master, now + 28.8)
      break
    case 12: // Testimonial Wall — warm chat pings green
      pad(audioCtx, master, [131, 175, 220, 262], 'sine', .016, 2, 28)
      arpNote(audioCtx, master, [262, 330, 392, 523], 280, 'sine', .018, 4)
      waPing(audioCtx, master, now + 1); waPing(audioCtx, master, now + 3.5)
      hit(audioCtx, master, now + 6, 'green')
      waPing(audioCtx, master, now + 9); waPing(audioCtx, master, now + 12.5)
      hit(audioCtx, master, now + 16, 'green'); cashFx(audioCtx, master, now + 19.5)
      waPing(audioCtx, master, now + 22.5)
      hit(audioCtx, master, now + 25.5, 'green'); cashFx(audioCtx, master, now + 28.5)
      break
    case 13: // Automation Stack — mechanical, technical indigo
      pad(audioCtx, master, [55, 82, 110, 164], 'sawtooth', .012, 1.5, 28)
      arpNote(audioCtx, master, [220, 330, 440, 660], 250, 'square', .016, 3)
      ticker(audioCtx, master, now + .5, 6, .14); hit(audioCtx, master, now + 3.5, 'blue')
      whooshFx(audioCtx, master, now + 7.5)
      ticker(audioCtx, master, now + 10, 8, .12); hit(audioCtx, master, now + 13.5, 'blue')
      whooshFx(audioCtx, master, now + 17)
      ticker(audioCtx, master, now + 20, 10, .11); hit(audioCtx, master, now + 24, 'green')
      cashFx(audioCtx, master, now + 27.5)
      break
    case 14: // ₹1 Crore Club — epic crescendo gold
      pad(audioCtx, master, [82, 103, 130, 164], 'triangle', .018, 2, 28)
      arpNote(audioCtx, master, [164, 207, 261, 330, 392, 523], 200, 'sine', .024, 2)
      hit(audioCtx, master, now + .5, 'green')
      ticker(audioCtx, master, now + 3, 12, .13); cashFx(audioCtx, master, now + 6.5)
      hit(audioCtx, master, now + 10, 'green'); cashFx(audioCtx, master, now + 13.5)
      ticker(audioCtx, master, now + 17, 15, .11); cashFx(audioCtx, master, now + 21)
      hit(audioCtx, master, now + 24.5, 'green')
      cashFx(audioCtx, master, now + 27); cashFx(audioCtx, master, now + 28.5)
      break
    case 15: // Competitor's Secret — mysterious, tense crimson
      pad(audioCtx, master, [73, 92, 110, 138], 'sawtooth', .012, 3, 27)
      arpNote(audioCtx, master, [138, 164, 196, 220, 174], 500, 'triangle', .018, 5)
      tone(audioCtx, master, now + 1, 220, .6, .1, 'sine', 110)
      noise(audioCtx, master, now + 4.5, .8, .1, 'bandpass', 800, .4)
      hit(audioCtx, master, now + 8, 'red')
      whooshFx(audioCtx, master, now + 12); hit(audioCtx, master, now + 16, 'orange')
      waPing(audioCtx, master, now + 20.5); cashFx(audioCtx, master, now + 24)
      hit(audioCtx, master, now + 27.5, 'green')
      break
    case 16: // Broadcast Power — radio waves, green ripples
      pad(audioCtx, master, [131, 196, 262, 392], 'sine', .016, 2, 28)
      arpNote(audioCtx, master, [392, 494, 587, 740, 880], 220, 'sine', .022, 3)
      waPing(audioCtx, master, now + .8); waPing(audioCtx, master, now + 2.2)
      hit(audioCtx, master, now + 4.5, 'green')
      waPing(audioCtx, master, now + 7.5); waPing(audioCtx, master, now + 10)
      cashFx(audioCtx, master, now + 13); hit(audioCtx, master, now + 16.5, 'green')
      ticker(audioCtx, master, now + 20, 12, .12); cashFx(audioCtx, master, now + 24)
      hit(audioCtx, master, now + 27.5, 'green')
      break
    case 17: // Ten Minute Setup — light, quick sky blue
      pad(audioCtx, master, [174, 220, 277, 349], 'triangle', .014, 1.5, 27)
      arpNote(audioCtx, master, [440, 523, 659, 784, 988], 180, 'sine', .022, 2)
      hit(audioCtx, master, now + .4, 'blue')
      ticker(audioCtx, master, now + 2, 10, .12); hit(audioCtx, master, now + 5, 'green')
      whooshFx(audioCtx, master, now + 8.5)
      ticker(audioCtx, master, now + 12, 6, .14); cashFx(audioCtx, master, now + 15.5)
      hit(audioCtx, master, now + 19, 'green')
      ticker(audioCtx, master, now + 22.5, 10, .11); cashFx(audioCtx, master, now + 26)
      hit(audioCtx, master, now + 28.5, 'green')
      break
    case 18: // Emoji Reactions — fun, bouncy colorful
      pad(audioCtx, master, [196, 247, 330, 392], 'triangle', .014, 2, 27)
      arpNote(audioCtx, master, [494, 587, 740, 880, 988, 1175], 160, 'sine', .020, 2)
      tone(audioCtx, master, now + .5, 1047, .1, .1, 'triangle')
      tone(audioCtx, master, now + 1.5, 1175, .12, .1, 'triangle')
      hit(audioCtx, master, now + 3, 'green')
      tone(audioCtx, master, now + 5.5, 1319, .1, .09, 'triangle')
      hit(audioCtx, master, now + 8, 'orange')
      tone(audioCtx, master, now + 11, 1047, .12, .1, 'triangle')
      cashFx(audioCtx, master, now + 14.5); hit(audioCtx, master, now + 18, 'green')
      tone(audioCtx, master, now + 21.5, 1319, .1, .09, 'triangle')
      cashFx(audioCtx, master, now + 24.5); hit(audioCtx, master, now + 27.5, 'green')
      cashFx(audioCtx, master, now + 29)
      break
    case 19: // The Proof — serious, corporate data slate
      pad(audioCtx, master, [82, 110, 130, 174], 'sine', .018, 2, 28)
      arpNote(audioCtx, master, [174, 220, 261, 330, 392], 350, 'triangle', .020, 4)
      hit(audioCtx, master, now + .5, 'blue')
      ticker(audioCtx, master, now + 3, 8, .15); cashFx(audioCtx, master, now + 7)
      hit(audioCtx, master, now + 11, 'green')
      ticker(audioCtx, master, now + 14.5, 10, .13); cashFx(audioCtx, master, now + 18)
      hit(audioCtx, master, now + 22, 'green')
      ticker(audioCtx, master, now + 25.5, 8, .12); cashFx(audioCtx, master, now + 28.5)
      break
    case 20: // Revenue Rocket — space launch, epic dark
      pad(audioCtx, master, [55, 82, 110, 138], 'sawtooth', .014, 3, 28)
      arpNote(audioCtx, master, [110, 138, 174, 220, 277, 349], 280, 'sine', .022, 2)
      noise(audioCtx, master, now + 1, .8, .1, 'lowpass', 400, .3)
      hit(audioCtx, master, now + 3, 'blue')
      noise(audioCtx, master, now + 5, 1.2, .12, 'lowpass', 600, .4)
      whooshFx(audioCtx, master, now + 9); hit(audioCtx, master, now + 11, 'green')
      cashFx(audioCtx, master, now + 14)
      whooshFx(audioCtx, master, now + 18.5); cashFx(audioCtx, master, now + 21)
      ticker(audioCtx, master, now + 24, 12, .12); hit(audioCtx, master, now + 27, 'green')
      cashFx(audioCtx, master, now + 28.5); cashFx(audioCtx, master, now + 29.2)
      break
    case 21:
      pad(audioCtx, master, [98, 147, 196, 294], 'triangle', .018, 1.2, 29)
      arpNote(audioCtx, master, [294, 392, 494, 587, 659], 280, 'sine', .028, 7.8)
      hit(audioCtx, master, now + .25, 'green'); ticker(audioCtx, master, now + 1.2, 8)
      whooshFx(audioCtx, master, now + 5.1); hit(audioCtx, master, now + 5.55, 'green')
      waPing(audioCtx, master, now + 10.3); waPing(audioCtx, master, now + 12.2); waPing(audioCtx, master, now + 15.5)
      cashFx(audioCtx, master, now + 18.6); ticker(audioCtx, master, now + 20.4, 10, .11)
      whooshFx(audioCtx, master, now + 23.4); hit(audioCtx, master, now + 24.1, 'green')
      cashFx(audioCtx, master, now + 26.5); hit(audioCtx, master, now + 28.2, 'green'); cashFx(audioCtx, master, now + 29.15)
      break
    case 22:
      pad(audioCtx, master, [82, 123, 164, 246], 'sawtooth', .012, 1.5, 29)
      arpNote(audioCtx, master, [220, 277, 330, 415, 554], 320, 'triangle', .025, 8.5)
      hit(audioCtx, master, now + .35, 'orange'); hit(audioCtx, master, now + 2.25, 'red')
      whooshFx(audioCtx, master, now + 5.4); tone(audioCtx, master, now + 6.2, 160, .4, .12, 'triangle', 80)
      waPing(audioCtx, master, now + 11.25); waPing(audioCtx, master, now + 13.4)
      hit(audioCtx, master, now + 15.2, 'green'); cashFx(audioCtx, master, now + 17.5)
      ticker(audioCtx, master, now + 20.1, 8, .13); hit(audioCtx, master, now + 22.4, 'green')
      whooshFx(audioCtx, master, now + 25.25); hit(audioCtx, master, now + 27.2, 'orange'); cashFx(audioCtx, master, now + 28.6)
      break
    default:
      pad(audioCtx, master, [131, 165, 196, 262], 'triangle', .018)
  }
}

/* ═══════════════════════════════════════════════════════════════════
   ADS 4–20 Renderers
   ══════════════════════════════════════════════════════════════════ */

/* Ad 4 — Dead Hours (midnight blue, clock) */
function renderAd4(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#040817'; ctx.fillRect(0, 0, W, H); grid(ctx)
  glow(ctx, W / 2, H / 2, 600, '99,102,241', .07 * cl(t / 2))

  if (t < 11) {
    const f = t < 1 ? pr(t, 0, 1) : t > 9.5 ? 1 - pr(t, 9.5, 11) : 1
    const cx = W / 2, cy = 430, r = 180
    ctx.save(); ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(99,102,241,.4)'; ctx.lineWidth = 3; ctx.stroke()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18), i % 3 === 0 ? 6 : 3, 0, Math.PI * 2)
      ctx.fillStyle = i % 3 === 0 ? '#818cf8' : 'rgba(99,102,241,.5)'; ctx.fill()
    }
    const ha = -Math.PI / 2, ma = -Math.PI / 2 + Math.PI / 6
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * r * .55, cy + Math.sin(ha) * r * .55); ctx.stroke()
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * r * .78, cy + Math.sin(ma) * r * .78); ctx.stroke()
    ctx.restore()
    txt(ctx, '11 PM — 7 AM', W / 2, 670, { size: 32, color: '#818cf8', weight: '800', alpha: f * pr(t, .5, 2) })
    txt(ctx, 'Your store earns ₹0.', W / 2, 730, { size: 28, color: '#94a3b8', weight: '400', alpha: f * pr(t, 1.5, 3) })
    txt(ctx, 'Every. Single. Night.', W / 2, 776, { size: 28, color: '#94a3b8', weight: '400', alpha: f * pr(t, 2.5, 4) })
  }
  if (t >= 10 && t < 22) {
    const lt = t - 10, f = lt < 1 ? pr(lt, 0, 1) : lt > 10.5 ? 1 - pr(lt, 10.5, 12) : 1
    txt(ctx, '2:34 AM', W / 2, 250, { size: 22, color: '#475569', weight: '600', alpha: f * pr(lt, 0, 1) })
    const msgs = [
      { t0: .3, s: 'out', lines: ['Hi! You left something', 'in your cart 🛍️'] },
      { t0: 2,  s: 'in',  lines: ['Oh wow thanks! Buying now!'] },
      { t0: 4,  s: 'out', lines: ['Order placed! ✅', 'Delivery in 2 days 🚀'] },
      { t0: 6.5,s: 'out', lines: ['Rate your experience?', '⭐⭐⭐⭐⭐'] },
    ]
    let my = 310
    msgs.forEach(m => {
      const mp = pr(lt, m.t0, m.t0 + .6); if (mp <= 0) return
      const bw = 380, lh = 28, bh = 28 + m.lines.length * lh
      const bx = m.s === 'out' ? W / 2 - bw - 10 : W / 2 + 10
      ctx.globalAlpha = f * mp; rr(ctx, bx, my, bw, bh, 18, m.s === 'out' ? '#005c4b' : '#1f2c34')
      m.lines.forEach((l, li) => txt(ctx, l, bx + 14, my + 28 + li * lh, { size: 19, weight: '400', align: 'left', alpha: f * mp }))
      my += bh + 14
    })
    ctx.globalAlpha = 1
    txt(ctx, 'Wapaci works while you sleep.', W / 2, 830, { size: 30, color: '#818cf8', weight: '700', alpha: f * pr(lt, 7, 9) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '99,102,241', .18 * f)
    txt(ctx, '₹87,000 earned', W / 2, 390, { size: 72, color: '#818cf8', weight: '900', alpha: f })
    txt(ctx, 'while you slept last night.', W / 2, 480, { size: 38, weight: '700', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 220, 580, 440, 82, 41, '#6366f1')
    txt(ctx, 'Try Wapaci Free →', W / 2, 621, { size: 28, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 720, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 5 — The 98% Club (gold, open rate comparison) */
function renderAd5(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0900'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(234,179,8,.02)')
  glow(ctx, W / 2, H / 2, 700, '234,179,8', .06 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, 'Email open rate?', W / 2, 360, { size: 48, color: '#475569', weight: '700', alpha: f * pr(t, 0, 1) })
    txt(ctx, '2%', W / 2, 530, { size: 180 * pr(t, .3, 1.5), color: '#374151', weight: '900', alpha: f * pr(t, .3, 1.5) })
    txt(ctx, 'Two. Percent.', W / 2, 680, { size: 30, color: '#374151', weight: '500', alpha: f * pr(t, 2, 3.5) })
  }
  if (t >= 7 && t < 16) {
    const lt = t - 7, f = lt < .8 ? pr(lt, 0, .8) : lt > 7.5 ? 1 - pr(lt, 7.5, 9) : 1
    txt(ctx, 'SMS open rate?', W / 2, 360, { size: 48, color: '#475569', weight: '700', alpha: f * pr(lt, 0, .8) })
    txt(ctx, '5%', W / 2, 530, { size: 180 * pr(lt, .3, 1.5), color: '#6b7280', weight: '900', alpha: f * pr(lt, .3, 1.5) })
    txt(ctx, 'Better. Still terrible.', W / 2, 680, { size: 30, color: '#6b7280', weight: '500', alpha: f * pr(lt, 2, 3.5) })
  }
  if (t >= 14 && t < 24) {
    const lt = t - 14, f = lt < 1 ? pr(lt, 0, 1) : lt > 9 ? 1 - pr(lt, 9, 10) : 1
    glow(ctx, W / 2, H / 2, 700, '234,179,8', .22 * f * pr(lt, 0, 2))
    txt(ctx, 'WhatsApp open rate?', W / 2, 290, { size: 38, color: '#a16207', weight: '700', alpha: f * pr(lt, 0, 1) })
    txt(ctx, '98%', W / 2, 510, { size: Math.min(240, 240 * pr(lt, .2, 1.8)), color: '#eab308', weight: '900', alpha: f * pr(lt, .2, 1.8) })
    burst(ctx, W / 2, 510, lt, 1.5, '#fbbf24')
    burst(ctx, W / 2, 510, lt, 1.5, '#f59e0b', 20)
    txt(ctx, 'NINETY. EIGHT. PERCENT.', W / 2, 700, { size: 32, color: '#eab308', weight: '800', alpha: f * pr(lt, 2, 3.5) })
    txt(ctx, '49× better than email.', W / 2, 752, { size: 26, color: '#a16207', weight: '500', alpha: f * pr(lt, 3.5, 5) })
  }
  if (t >= 23) {
    const lt = t - 23, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '234,179,8', .2 * f)
    txt(ctx, 'Join the 98% Club.', W / 2, 400, { size: 68, weight: '900', color: '#eab308', alpha: f })
    txt(ctx, 'WhatsApp automation by Wapaci.', W / 2, 490, { size: 30, color: '#94a3b8', weight: '400', alpha: f * pr(lt, .5, 1.5) })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 220, 580, 440, 82, 41, '#eab308')
    txt(ctx, 'Get Started Free →', W / 2, 621, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 720, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 6 — COD Recovery (orange, returns reduction) */
function renderAd6(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0d0700'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(249,115,22,.025)')
  glow(ctx, 200, 300, 500, '249,115,22', .08 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    const bx = W / 2 - 120, by = 330, bw = 240, bh = 200
    ctx.globalAlpha = f * pr(t, .3, 1.5)
    rr(ctx, bx, by, bw, bh, 12, 'rgba(249,115,22,.15)', 'rgba(249,115,22,.5)', 2)
    txt(ctx, '📦', W / 2, by + bh / 2, { size: 80, alpha: f * pr(t, .3, 1.5) })
    txt(ctx, '32% of COD orders', W / 2, 595, { size: 36, weight: '800', color: '#f97316', alpha: f * pr(t, 1, 2.5) })
    txt(ctx, 'are returned. Unopened.', W / 2, 648, { size: 34, weight: '400', color: '#94a3b8', alpha: f * pr(t, 1.5, 3) })
    txt(ctx, "That's ₹1.6L wasted every month.", W / 2, 730, { size: 26, color: '#6b7280', alpha: f * pr(t, 3, 5) })
    ctx.globalAlpha = 1
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    txt(ctx, 'Wapaci sends a WhatsApp', W / 2, 270, { size: 30, color: '#f97316', weight: '700', alpha: f * pr(lt, 0, 1) })
    txt(ctx, 'confirmation before delivery.', W / 2, 314, { size: 30, color: '#f97316', weight: '700', alpha: f * pr(lt, .3, 1.3) })
    const msgs = [
      { t0: 1,   lines: ['📦 Your order arrives tomorrow!', 'Confirm delivery? Reply YES'] },
      { t0: 3.5, lines: ['YES please! 👍'] },
      { t0: 5.5, lines: ['✅ Confirmed! See you tomorrow.'] },
    ]
    const sides = ['out', 'in', 'out']
    let my = 380
    msgs.forEach((m, i) => {
      const mp = pr(lt, m.t0, m.t0 + .7); if (mp <= 0) return
      const bw = 400, lh = 28, bh = 28 + m.lines.length * lh
      const bx = sides[i] === 'out' ? W / 2 - bw - 10 : W / 2 + 10
      ctx.globalAlpha = f * mp; rr(ctx, bx, my, bw, bh, 18, sides[i] === 'out' ? '#005c4b' : '#1f2c34')
      m.lines.forEach((l, li) => txt(ctx, l, bx + 14, my + 26 + li * lh, { size: 18, weight: '400', align: 'left', alpha: f * mp }))
      my += bh + 12
    })
    ctx.globalAlpha = 1
    txt(ctx, 'Customer confirms. Return eliminated.', W / 2, 810, { size: 24, color: '#25D366', weight: '700', alpha: f * pr(lt, 7, 9) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .18 * f)
    txt(ctx, 'COD Returns', W / 2, 380, { size: 60, weight: '900', alpha: f })
    txt(ctx, '↓ 40%', W / 2, 468, { size: 88, color: '#25D366', weight: '900', alpha: f })
    txt(ctx, 'Wapaci COD confirmation flow.', W / 2, 570, { size: 26, color: '#94a3b8', weight: '400', alpha: f * pr(lt, .5, 1.5) })
    ctx.globalAlpha = f * pr(lt, .6, 1.5)
    rr(ctx, W / 2 - 215, 640, 430, 80, 40, '#f97316')
    txt(ctx, 'Reduce Returns Today →', W / 2, 680, { size: 26, color: '#fff', weight: '800', alpha: f * pr(lt, .6, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 775, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 7 — Ghost Customers (purple, cartoon) */
function renderAd7(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#08030f'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(168,85,247,.025)')
  glow(ctx, W / 2, 400, 550, '168,85,247', .09 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    txt(ctx, 'Remember these customers?', W / 2, 230, { size: 36, color: '#a78bfa', weight: '700', alpha: f * pr(t, 0, 1) })
    const positions = [150, 350, 550, 750, 950]
    positions.forEach((x, i) => {
      const fp = f * pr(t, .2 + i * .15, .9 + i * .15)
      const fade = t > 3 ? pr(t, 3 + i * .4, 5 + i * .4) : 0
      const col = `rgba(168,85,247,${Math.max(.1, .85 - fade * .75)})`
      rr(ctx, x - 60, 310, 120, 280, 60, col); ctx.globalAlpha = fp * (1 - fade * .6)
      txt(ctx, ['👩', '👨', '👧', '👦', '👴'][i], x, 410, { size: 70, alpha: fp })
      ghost(ctx, x, 600, 90, fp * fade)
      ctx.globalAlpha = 1
    })
    txt(ctx, '60 days of silence.', W / 2, 700, { size: 38, color: '#7c3aed', weight: '800', alpha: f * pr(t, 4, 6) })
    txt(ctx, "They've become ghosts.", W / 2, 756, { size: 34, color: '#94a3b8', weight: '400', alpha: f * pr(t, 5, 7) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    const positions = [180, 400, 540, 760, 900]
    positions.forEach((x, i) => {
      const fp = f * pr(lt, .2 + i * .2, 1 + i * .2)
      const ret = pr(lt, 3 + i * .3, 5.5 + i * .3)
      ghost(ctx, x, 370, 90, fp * (1 - ret))
      const col = `rgba(168,85,247,${ret * .9})`
      rr(ctx, x - 60, 290, 120, 200, 60, col); ctx.globalAlpha = fp * ret
      txt(ctx, ['👩', '👨', '👧', '👦', '👴'][i], x, 360, { size: 60, alpha: fp * ret })
      ctx.globalAlpha = 1
    })
    rr(ctx, 160, 540, 760, 90, 20, 'rgba(168,85,247,.1)', 'rgba(168,85,247,.4)', 1.5)
    txt(ctx, '💬  "We miss you! Here\'s 15% OFF"', W / 2, 585, { size: 24, color: '#c4b5fd', weight: '600', alpha: f * pr(lt, 2, 3.5) })
    txt(ctx, 'Wapaci Win-Back. Ghosts return.', W / 2, 750, { size: 34, color: '#a78bfa', weight: '800', alpha: f * pr(lt, 6, 8) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '168,85,247', .2 * f)
    txt(ctx, '15% of lost customers', W / 2, 380, { size: 48, weight: '800', alpha: f })
    txt(ctx, 'come back with Wapaci.', W / 2, 448, { size: 48, color: '#a78bfa', weight: '800', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 215, 560, 430, 82, 41, '#7c3aed')
    txt(ctx, 'Bring Back Lost Customers →', W / 2, 601, { size: 26, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 700, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 8 — The Leaky Bucket (blue, revenue leaking) */
function renderAd8(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#020c1a'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(59,130,246,.025)')
  glow(ctx, W / 2, H / 2, 600, '59,130,246', .08 * cl(t / 2))

  const drawBucket = (alpha: number, holes: boolean, plugged: boolean) => {
    ctx.save(); ctx.globalAlpha = alpha
    const bx = W / 2 - 160, by = 260, bw = 320, bh = 350
    ctx.beginPath(); ctx.moveTo(bx + 30, by); ctx.lineTo(bx + bw - 30, by)
    ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath()
    ctx.fillStyle = 'rgba(59,130,246,.12)'; ctx.fill()
    ctx.strokeStyle = plugged ? 'rgba(37,211,102,.7)' : 'rgba(59,130,246,.6)'; ctx.lineWidth = 3; ctx.stroke()
    txt(ctx, '₹', W / 2, by + bh / 2, { size: 80, color: plugged ? '#25D366' : '#3b82f6', weight: '900', alpha })
    if (holes) {
      ;[0.25, 0.5, 0.75].forEach((p, i) => {
        const hx = bx + bw * p, hy = by + bh * (0.4 + i * 0.2)
        if (!plugged) {
          ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2)
          ctx.fillStyle = '#020c1a'; ctx.fill()
          ctx.strokeStyle = 'rgba(239,68,68,.8)'; ctx.lineWidth = 2; ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(37,211,102,.4)'; ctx.fill()
        }
      })
    }
    ctx.restore()
  }

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    drawBucket(f, true, false)
    const leaks = [
      { label: 'Cart Abandonment', v: '₹2.4L/mo', x: W / 2 - 270, y: 440 },
      { label: 'No Follow-up', v: '₹1.1L/mo', x: W / 2 - 270, y: 530 },
      { label: 'Lost Customers', v: '₹0.8L/mo', x: W / 2 - 270, y: 620 },
    ]
    leaks.forEach((lk, i) => {
      const lp = f * pr(t, 1.5 + i * .7, 2.5 + i * .7)
      for (let d = 0; d < 4; d++) {
        const dy = ((t * 80 + d * 30) % 100)
        ctx.globalAlpha = lp * (1 - dy / 100)
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(W / 2 - 150 + i * 60, lk.y - 20 + dy, 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      txt(ctx, `${lk.v} — ${lk.label}`, 380, lk.y, { size: 20, color: '#ef4444', weight: '600', alpha: lp, align: 'right' as CanvasTextAlign })
    })
    txt(ctx, 'Total leaking: ₹4.3L every month', W / 2, 800, { size: 28, color: '#94a3b8', weight: '700', alpha: f * pr(t, 5, 7) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    drawBucket(f, true, pr(lt, 2, 5) > .5)
    txt(ctx, 'Wapaci plugs every leak.', W / 2, 700, { size: 34, color: '#25D366', weight: '800', alpha: f * pr(lt, 3, 5) })
    const flows = ['Cart Recovery', 'Follow-up Flows', 'Win-Back Campaigns']
    flows.forEach((fl, i) => {
      ctx.globalAlpha = f * pr(lt, 3.5 + i * .5, 5 + i * .5)
      rr(ctx, W / 2 - 185, 750 + i * 50, 370, 36, 18, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.35)')
      txt(ctx, `✓  ${fl}`, W / 2, 768 + i * 50, { size: 18, color: '#25D366', weight: '600', alpha: f * pr(lt, 3.5 + i * .5, 5 + i * .5) })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .18 * f)
    txt(ctx, 'Stop leaking ₹4.3L', W / 2, 390, { size: 60, weight: '900', alpha: f })
    txt(ctx, 'every month.', W / 2, 464, { size: 60, color: '#3b82f6', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .6, 1.5)
    rr(ctx, W / 2 - 210, 570, 420, 82, 41, '#3b82f6')
    txt(ctx, 'Plug the Leaks with Wapaci →', W / 2, 611, { size: 24, color: '#fff', weight: '800', alpha: f * pr(lt, .6, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 710, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 9 — Flash Sale Blast (red, particles explosion) */
function renderAd9(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0d0000'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(239,68,68,.03)')
  glow(ctx, W / 2, H / 2, 700, '239,68,68', .06 * cl(t / 2))

  if (t < 8) {
    const f = t < .5 ? pr(t, 0, .5) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, 'FLASH SALE', W / 2, 340, { size: 88, color: '#ef4444', weight: '900', alpha: f * pr(t, 0, .8) })
    txt(ctx, 'BROADCAST IN', W / 2, 440, { size: 52, color: '#94a3b8', weight: '700', alpha: f * pr(t, .3, 1.2) })
    const secs = Math.max(0, Math.ceil(5 - t * 1.5))
    txt(ctx, String(secs || '🚀'), W / 2, 610, { size: 200 - secs * 20, color: secs === 0 ? '#fbbf24' : '#ef4444', weight: '900', alpha: f })
  }
  if (t >= 7) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 14 ? 1 - pr(lt, 14, 15) : 1
    glow(ctx, W / 2, H / 2, 800, '239,68,68', .25 * f * pr(lt, 0, 1.5))
    burst(ctx, W / 2, H / 2, lt, 0, '#ef4444', 36)
    burst(ctx, W / 2, H / 2, lt, 0, '#fbbf24', 24)
    burst(ctx, W / 2, H / 2, lt, .3, '#f97316', 20)
    txt(ctx, 'BROADCAST SENT!', W / 2, 310, { size: 72, color: '#fbbf24', weight: '900', alpha: f * pr(lt, .2, 1.5) })
    const stats = [
      { v: '50,000', l: 'Customers Reached' },
      { v: '98%', l: 'Will See It in 3 Min' },
      { v: '₹12L', l: 'Revenue in 4 Hours' },
    ]
    stats.forEach((s, i) => {
      const sp = pr(lt, 1.5 + i * .5, 2.8 + i * .5); ctx.globalAlpha = f * sp
      rr(ctx, 80 + i * 320, 450, 290, 180, 20, 'rgba(239,68,68,.1)', 'rgba(239,68,68,.35)')
      txt(ctx, s.v, 225 + i * 320, 518, { size: 52, color: '#fbbf24', weight: '900', alpha: f * sp })
      txt(ctx, s.l, 225 + i * 320, 582, { size: 18, color: '#94a3b8', weight: '500', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }
  if (t >= 22) {
    const lt = t - 22, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '239,68,68', .2 * f)
    txt(ctx, 'WhatsApp Broadcast.', W / 2, 390, { size: 60, weight: '900', alpha: f })
    txt(ctx, 'Nothing else comes close.', W / 2, 466, { size: 46, color: '#ef4444', weight: '800', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 215, 568, 430, 82, 41, '#ef4444')
    txt(ctx, 'Launch Your Flash Sale →', W / 2, 609, { size: 26, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 710, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 10 — Order Update Delight (teal, journey) */
function renderAd10(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#020f0d'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(20,184,166,.025)')
  glow(ctx, W / 2, H / 2, 600, '20,184,166', .07 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    txt(ctx, 'Your customer just ordered.', W / 2, 300, { size: 40, weight: '700', alpha: f * pr(t, 0, 1) })
    txt(ctx, '📱', W / 2, 500, { size: 160, alpha: f * pr(t, .3, 1.5) })
    txt(ctx, 'Now what?', W / 2, 720, { size: 46, color: '#14b8a6', weight: '800', alpha: f * pr(t, 2, 3.5) })
    txt(ctx, 'Silence? Email? Nothing?', W / 2, 782, { size: 30, color: '#6b7280', weight: '400', alpha: f * pr(t, 4, 6) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    const steps = [
      { icon: '✅', label: 'Order Placed', sub: 'Thank you message + receipt', t0: .3 },
      { icon: '📦', label: 'Packing',      sub: 'Estimated dispatch time',       t0: 2 },
      { icon: '🚚', label: 'Shipped',      sub: 'Tracking link sent instantly',  t0: 3.8 },
      { icon: '🏠', label: 'Delivered',    sub: 'Ask for review + next offer',   t0: 5.8 },
    ]
    const lineY = 400
    ctx.globalAlpha = f
    ctx.strokeStyle = 'rgba(20,184,166,.3)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(130, lineY); ctx.lineTo(950, lineY); ctx.stroke()
    steps.forEach((s, i) => {
      const sp = pr(lt, s.t0, s.t0 + .8), sx = 130 + i * 273
      ctx.globalAlpha = f * sp
      ctx.beginPath(); ctx.arc(sx, lineY, 28, 0, Math.PI * 2)
      ctx.fillStyle = '#14b8a6'; ctx.fill()
      txt(ctx, s.icon, sx, lineY, { size: 26, alpha: f * sp })
      txt(ctx, s.label, sx, lineY + 60, { size: 18, color: '#14b8a6', weight: '700', alpha: f * sp })
      txt(ctx, s.sub, sx, lineY + 92, { size: 14, color: '#64748b', weight: '400', alpha: f * sp })
      ctx.globalAlpha = 1
    })
    const reacts = ['😍', '🔥', '💯', '🎉']
    reacts.forEach((r, i) => {
      const rp = pr(lt, 7 + i * .4, 8 + i * .4)
      const ry = 600 - rp * 120
      txt(ctx, r, 200 + i * 230, ry, { size: 60 + rp * 20, alpha: f * rp * (1 - Math.max(0, rp - .7) * 3) })
    })
    txt(ctx, 'Every update. On WhatsApp. Instantly.', W / 2, 840, { size: 26, color: '#14b8a6', weight: '700', alpha: f * pr(lt, 9, 11) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '20,184,166', .18 * f)
    txt(ctx, '8 in 10 customers', W / 2, 380, { size: 58, weight: '900', alpha: f })
    txt(ctx, 'say WhatsApp updates build trust.', W / 2, 454, { size: 38, color: '#14b8a6', weight: '700', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 210, 570, 420, 82, 41, '#14b8a6')
    txt(ctx, 'Delight Your Customers →', W / 2, 611, { size: 26, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 712, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 11 — Win-Back Campaign (cyan, fading silhouettes) */
function renderAd11(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#020a0d'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(6,182,212,.025)')
  glow(ctx, W / 2, H / 2, 600, '6,182,212', .07 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    txt(ctx, '60 days of silence.', W / 2, 270, { size: 52, weight: '800', color: '#06b6d4', alpha: f * pr(t, 0, 1) })
    const xs = [150, 310, 470, 630, 790, 930]
    xs.forEach((x, i) => {
      const fade = pr(t, 1 + i * .3, 3 + i * .3), fp = f * pr(t, .2 + i * .1, .9 + i * .1)
      const col = `rgba(6,182,212,${.85 - fade * .75})`
      rr(ctx, x - 60, 340, 120, 200, 60, col); ctx.globalAlpha = fp
      txt(ctx, ['👩', '👨', '👧', '👦', '🧓', '👴'][i], x, 410, { size: 55, alpha: fp * (1 - fade * .8) })
      ctx.globalAlpha = 1
    })
    txt(ctx, 'They bought once.', W / 2, 640, { size: 38, color: '#475569', weight: '600', alpha: f * pr(t, 3, 5) })
    txt(ctx, 'Then... disappeared.', W / 2, 696, { size: 38, color: '#475569', weight: '600', alpha: f * pr(t, 4.5, 6.5) })
    txt(ctx, 'Sound familiar?', W / 2, 784, { size: 34, color: '#0e7490', weight: '700', alpha: f * pr(t, 7, 9) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    rr(ctx, 140, 260, 800, 110, 24, 'rgba(6,182,212,.1)', 'rgba(6,182,212,.4)', 1.5)
    txt(ctx, '💬  "Hey! We miss you. Here\'s 20% OFF"', W / 2, 315, { size: 24, color: '#67e8f9', weight: '600', alpha: f * pr(lt, 0, 1.5) })
    const xs = [150, 310, 470, 630, 790, 930]
    xs.forEach((x, i) => {
      const ret = pr(lt, 2 + i * .35, 4.5 + i * .35), fp = f * pr(lt, .2 + i * .1, .9 + i * .1)
      const col = `rgba(6,182,212,${.1 + ret * .75})`
      rr(ctx, x - 60, 430, 120, 200, 60, col); ctx.globalAlpha = fp
      txt(ctx, ['👩', '👨', '👧', '👦', '🧓', '👴'][i], x, 498, { size: 55, alpha: fp * ret })
      ctx.globalAlpha = 1
    })
    txt(ctx, 'They came back. 💚', W / 2, 750, { size: 44, color: '#06b6d4', weight: '800', alpha: f * pr(lt, 7, 9) })
    txt(ctx, 'Wapaci Win-Back flow. Automatic.', W / 2, 818, { size: 26, color: '#0e7490', weight: '600', alpha: f * pr(lt, 9, 11) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '6,182,212', .2 * f)
    txt(ctx, '₹1.8L recovered monthly', W / 2, 390, { size: 56, color: '#06b6d4', weight: '900', alpha: f })
    txt(ctx, 'from customers who ghosted you.', W / 2, 466, { size: 34, weight: '600', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 210, 570, 420, 82, 41, '#06b6d4')
    txt(ctx, 'Win Back Lost Customers →', W / 2, 611, { size: 26, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 712, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 12 — Testimonial Wall (green, chat bubbles) */
function renderAd12(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#03100a'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(37,211,102,.02)')
  glow(ctx, W / 2, H / 2, 600, '37,211,102', .07 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, '500+ Indian D2C brands', W / 2, 400, { size: 58, color: '#25D366', weight: '900', alpha: f * pr(t, 0, 1) })
    txt(ctx, 'use Wapaci. Here\'s what they say.', W / 2, 480, { size: 36, weight: '500', alpha: f * pr(t, .5, 1.8) })
  }
  if (t >= 7) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 19 ? 1 - pr(lt, 19, 21) : 1
    const testimonials = [
      { brand: 'FreshCart', text: '"Cart recovery alone pays for the plan 10×. We made ₹2.4L in month one."', t0: .3 },
      { brand: 'StyleKart',  text: '"COD returns dropped from 38% to 19%. That\'s real money saved."',           t0: 2.5 },
      { brand: 'NutriBox',   text: '"Our customers love the order updates on WhatsApp. 5-star reviews went up."', t0: 5 },
      { brand: 'GlowSkin',   text: '"Win-back campaigns brought back 800+ customers we thought were gone."',       t0: 7.5 },
      { brand: 'FitGear',    text: '"47× ROI in 90 days. Best marketing investment we\'ve made."',                t0: 10 },
    ]
    testimonials.forEach((tm, i) => {
      const tp = pr(lt, tm.t0, tm.t0 + .8); if (tp <= 0) return
      const by = 200 + i * 152
      ctx.globalAlpha = f * tp; rr(ctx, 80, by, 920, 128, 18, 'rgba(37,211,102,.08)', 'rgba(37,211,102,.25)')
      txt(ctx, tm.brand, 136, by + 34, { size: 18, color: '#25D366', weight: '800', alpha: f * tp, align: 'left' as CanvasTextAlign })
      txt(ctx, tm.text, 540, by + 80, { size: 17, color: '#94a3b8', weight: '400', alpha: f * tp })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 26) {
    const lt = t - 26, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .2 * f)
    txt(ctx, 'Join 500+ brands growing', W / 2, 390, { size: 48, weight: '800', alpha: f })
    txt(ctx, 'with WhatsApp automation.', W / 2, 454, { size: 48, color: '#25D366', weight: '800', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 560, 410, 82, 41, '#25D366')
    txt(ctx, 'Start Free Today →', W / 2, 601, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 700, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 13 — Automation Stack (indigo, flowchart) */
function renderAd13(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#04030f'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(99,102,241,.025)')
  glow(ctx, 200, 300, 500, '99,102,241', .08 * cl(t / 2))
  glow(ctx, 800, 700, 400, '167,139,250', .06 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, 'One platform.', W / 2, 380, { size: 76, weight: '900', alpha: f * pr(t, 0, 1) })
    txt(ctx, 'Five automations.', W / 2, 472, { size: 76, color: '#818cf8', weight: '900', alpha: f * pr(t, .5, 1.5) })
    txt(ctx, 'Running 24/7.', W / 2, 564, { size: 76, color: '#a78bfa', weight: '900', alpha: f * pr(t, 1, 2) })
  }
  if (t >= 7 && t < 24) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 15 ? 1 - pr(lt, 15, 17) : 1
    const flows = [
      { trigger: 'Cart Abandoned', action: 'WhatsApp Recovery', result: '+28% Recovery', color: '#ef4444', t0: .3 },
      { trigger: 'COD Order',      action: 'Confirmation Flow', result: '-40% Returns',  color: '#f97316', t0: 2.2 },
      { trigger: 'New Customer',   action: 'Welcome Series',    result: '2× Retention',  color: '#25D366', t0: 4.2 },
      { trigger: '60d Inactive',   action: 'Win-Back Offer',    result: '15% Come Back', color: '#06b6d4', t0: 6.2 },
      { trigger: 'After Delivery', action: 'Review + Upsell',   result: '+₹800 AOV',     color: '#a78bfa', t0: 8.2 },
    ]
    flows.forEach((fl, i) => {
      const fp = pr(lt, fl.t0, fl.t0 + .8), fy = 190 + i * 148
      ctx.globalAlpha = f * fp
      rr(ctx, 60, fy, 240, 66, 14, `${fl.color}18`, `${fl.color}55`)
      txt(ctx, fl.trigger, 180, fy + 33, { size: 17, color: fl.color, weight: '700', alpha: f * fp })
      ctx.strokeStyle = `${fl.color}60`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(300, fy + 33); ctx.lineTo(480, fy + 33); ctx.stroke(); ctx.setLineDash([])
      txt(ctx, '▶', 390, fy + 33, { size: 14, color: fl.color, alpha: f * fp })
      rr(ctx, 480, fy, 250, 66, 14, `${fl.color}18`, `${fl.color}55`)
      txt(ctx, fl.action, 605, fy + 33, { size: 17, color: fl.color, weight: '700', alpha: f * fp })
      ctx.strokeStyle = `${fl.color}60`; ctx.beginPath(); ctx.moveTo(730, fy + 33); ctx.lineTo(830, fy + 33); ctx.stroke()
      txt(ctx, '▶', 780, fy + 33, { size: 14, color: fl.color, alpha: f * fp })
      rr(ctx, 830, fy, 210, 66, 14, `${fl.color}25`, `${fl.color}70`)
      txt(ctx, fl.result, 935, fy + 33, { size: 18, color: '#fff', weight: '800', alpha: f * fp })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 23) {
    const lt = t - 23, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '99,102,241', .2 * f)
    txt(ctx, 'Set up in 10 minutes.', W / 2, 390, { size: 52, weight: '800', alpha: f })
    txt(ctx, 'Run forever.', W / 2, 460, { size: 52, color: '#818cf8', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 210, 565, 420, 82, 41, '#6366f1')
    txt(ctx, 'Automate Revenue Now →', W / 2, 606, { size: 26, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 706, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 14 — ₹1 Crore Club (gold, crazy counter + shockwaves) */
function renderAd14(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#080600'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(234,179,8,.03)')
  glow(ctx, W / 2, H / 2, 700, '234,179,8', .08 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    txt(ctx, 'Your next revenue milestone', W / 2, 330, { size: 36, color: '#a16207', weight: '700', alpha: f * pr(t, 0, 1) })
    const val = Math.round(10_000_000 * eOut(cl(t / 8)))
    txt(ctx, `₹${val.toLocaleString('en-IN')}`, W / 2, 510, { size: 86, color: '#eab308', weight: '900', alpha: f })
    txt(ctx, '₹1,00,00,000', W / 2, 650, { size: 28, color: '#78350f', weight: '600', alpha: f * pr(t, 2, 4) })
    txt(ctx, 'One. Crore. Rupees.', W / 2, 710, { size: 26, color: '#92400e', weight: '600', alpha: f * pr(t, 4, 6) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11 ? 1 - pr(lt, 11, 13) : 1
    glow(ctx, W / 2, H / 2, 700, '234,179,8', .2 * f * pr(lt, 0, 2))
    for (let r = 0; r < 5; r++) {
      const rp = cl((lt - r * .4) / 2), rr2 = rp * 600
      ctx.globalAlpha = f * Math.max(0, 1 - rp * 1.1) * .5
      ctx.beginPath(); ctx.arc(W / 2, H / 2, rr2, 0, Math.PI * 2)
      ctx.strokeStyle = '#eab308'; ctx.lineWidth = 3 - rp * 2; ctx.stroke()
      ctx.globalAlpha = 1
    }
    txt(ctx, 'YOUR MILESTONE', W / 2, 290, { size: 36, color: '#78350f', weight: '800', alpha: f * pr(lt, 0, 1) })
    txt(ctx, '₹1 CRORE', W / 2, 480, { size: 140, color: '#eab308', weight: '900', alpha: f })
    burst(ctx, W / 2, 480, lt, .5, '#fbbf24', 30)
    burst(ctx, W / 2, 480, lt, .5, '#f59e0b', 20)
    const items = ['Cart Recovery +₹2.4L', 'COD Fix +₹1.6L', 'Win-Back +₹1.8L', 'Upsells +₹2.1L', 'Broadcasts +₹2.1L']
    items.forEach((it, i) => {
      ctx.globalAlpha = f * pr(lt, 5 + i * .5, 7 + i * .5)
      rr(ctx, W / 2 - 225, 650 + i * 56, 450, 42, 12, 'rgba(234,179,8,.1)', 'rgba(234,179,8,.3)')
      txt(ctx, it, W / 2, 671 + i * 56, { size: 18, color: '#eab308', weight: '700', alpha: f * pr(lt, 5 + i * .5, 7 + i * .5) })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 700, '234,179,8', .25 * f)
    txt(ctx, 'Join the', W / 2, 360, { size: 52, weight: '700', alpha: f })
    txt(ctx, '₹1 Crore Club', W / 2, 438, { size: 72, color: '#eab308', weight: '900', alpha: f })
    txt(ctx, '500+ brands already inside.', W / 2, 530, { size: 28, color: '#92400e', weight: '500', alpha: f * pr(lt, .4, 1.4) })
    ctx.globalAlpha = f * pr(lt, .6, 1.5)
    rr(ctx, W / 2 - 210, 600, 420, 82, 41, '#eab308')
    txt(ctx, 'Claim Your Spot →', W / 2, 641, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .6, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 740, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 15 — Competitor's Secret (crimson, mystery reveal) */
function renderAd15(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0d0003'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(220,38,38,.025)')
  glow(ctx, W / 2, H / 2, 600, '220,38,38', .07 * cl(t / 2))

  if (t < 10) {
    const f = t < .8 ? pr(t, 0, .8) : t > 9 ? 1 - pr(t, 9, 10) : 1
    txt(ctx, 'Your top competitor', W / 2, 350, { size: 52, weight: '700', alpha: f * pr(t, 0, 1) })
    txt(ctx, 'has a secret.', W / 2, 420, { size: 52, weight: '700', alpha: f * pr(t, .4, 1.4) })
    txt(ctx, '...', W / 2, 550, { size: 80, color: '#dc2626', weight: '900', alpha: f * pr(t, 2, 4) * Math.abs(Math.sin(t * 4)) })
    txt(ctx, 'Want to know what it is?', W / 2, 700, { size: 34, color: '#7f1d1d', weight: '600', alpha: f * pr(t, 5, 7.5) })
  }
  if (t >= 9 && t < 22) {
    const lt = t - 9, f = lt < 1 ? pr(lt, 0, 1) : lt > 11.5 ? 1 - pr(lt, 11.5, 13) : 1
    glow(ctx, W / 2, H / 2, 500, '220,38,38', .18 * f * pr(lt, 0, 1.5))
    txt(ctx, 'They use', W / 2, 310, { size: 40, color: '#9ca3af', weight: '500', alpha: f * pr(lt, 0, 1) })
    txt(ctx, 'WhatsApp Automation.', W / 2, 390, { size: 56, color: '#dc2626', weight: '900', alpha: f * pr(lt, .4, 1.6) })
    const rows = [
      { them: '₹3.2L recovered/mo', you: '₹0 recovered', label: 'Cart Recovery' },
      { them: '18% COD returns', you: '38% COD returns', label: 'COD Confirm' },
      { them: '500+ reviews/mo', you: '12 reviews/mo', label: 'Review Flows' },
    ]
    rows.forEach((r, i) => {
      const rp = pr(lt, 2 + i * .6, 3.2 + i * .6); ctx.globalAlpha = f * rp
      rr(ctx, 60, 470 + i * 120, 440, 88, 16, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.3)')
      txt(ctx, r.them, 280, 514 + i * 120, { size: 20, color: '#25D366', weight: '700', alpha: f * rp })
      rr(ctx, 580, 470 + i * 120, 440, 88, 16, 'rgba(220,38,38,.1)', 'rgba(220,38,38,.3)')
      txt(ctx, r.you, 800, 514 + i * 120, { size: 20, color: '#dc2626', weight: '700', alpha: f * rp })
      txt(ctx, r.label, W / 2, 494 + i * 120, { size: 14, color: '#475569', weight: '600', alpha: f * rp })
      ctx.globalAlpha = 1
    })
    txt(ctx, 'Them   vs   You', W / 2, 460, { size: 22, color: '#475569', weight: '600', alpha: f * pr(lt, 1.5, 2.5) })
  }
  if (t >= 21) {
    const lt = t - 21, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '37,211,102', .18 * f)
    txt(ctx, 'Now you know the secret.', W / 2, 380, { size: 46, weight: '700', alpha: f })
    txt(ctx, 'Time to use it.', W / 2, 448, { size: 46, color: '#25D366', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 560, 410, 82, 41, '#25D366')
    txt(ctx, 'Get the Competitive Edge →', W / 2, 601, { size: 24, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 702, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 16 — Broadcast Power (green, ripple circles) */
function renderAd16(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#010d05'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(37,211,102,.02)')
  glow(ctx, W / 2, H / 2, 700, '37,211,102', .07 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2)
    ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, H / 2, { size: 60, alpha: f })
    txt(ctx, 'You wrote 1 message.', W / 2, 760, { size: 38, weight: '700', alpha: f * pr(t, .5, 2) })
    txt(ctx, 'Watch what happens next.', W / 2, 822, { size: 28, color: '#166534', weight: '500', alpha: f * pr(t, 2.5, 4.5) })
    ctx.globalAlpha = 1
  }
  if (t >= 7 && t < 23) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 14 ? 1 - pr(lt, 14, 16) : 1
    ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, H / 2, { size: 60, alpha: f })
    for (let r = 0; r < 6; r++) {
      const rp = cl((lt - r * .6) / 3.5), rad = 70 + rp * 520
      ctx.globalAlpha = f * Math.max(0, 1 - rp * 1.05) * .7
      ctx.beginPath(); ctx.arc(W / 2, H / 2, rad, 0, Math.PI * 2)
      ctx.strokeStyle = '#25D366'; ctx.lineWidth = 3 - rp * 2.5; ctx.stroke()
    }
    ctx.globalAlpha = 1
    const counts = [['1', 'message sent'], ['50,000', 'customers reached'], ['98%', 'open it in 3 min'], ['₹12L', 'revenue in 4 hrs']]
    counts.forEach(([v, l], i) => {
      const cp = pr(lt, 2 + i * 1.5, 3.2 + i * 1.5)
      ctx.globalAlpha = f * cp
      rr(ctx, W / 2 - 200, 780 + (i % 2) * 0, 400, 60, 14, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.3)')
      // place in corners
      const positions = [[130, 180], [930, 180], [130, 900], [930, 900]]
      const [px, py] = positions[i]
      rr(ctx, px - 95, py - 30, 190, 60, 14, 'rgba(37,211,102,.15)', 'rgba(37,211,102,.4)')
      txt(ctx, v, px, py - 2, { size: 22, color: '#25D366', weight: '900', alpha: f * cp })
      txt(ctx, l, px, py + 22, { size: 12, color: '#166534', weight: '600', alpha: f * cp })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 22) {
    const lt = t - 22, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 700, '37,211,102', .22 * f)
    txt(ctx, '1 message.', W / 2, 380, { size: 68, weight: '900', color: '#25D366', alpha: f })
    txt(ctx, '50,000 customers.', W / 2, 464, { size: 56, weight: '900', alpha: f })
    txt(ctx, 'Instant.', W / 2, 536, { size: 56, weight: '900', color: '#25D366', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 610, 410, 82, 41, '#25D366')
    txt(ctx, 'Launch Your Broadcast →', W / 2, 651, { size: 26, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 752, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 17 — Ten Minute Setup (sky blue, circular timer) */
function renderAd17(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H); grid(ctx, 'rgba(56,189,248,.025)')
  glow(ctx, W / 2, H / 2, 600, '56,189,248', .07 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, 'How long does it take', W / 2, 350, { size: 46, weight: '700', alpha: f * pr(t, 0, 1) })
    txt(ctx, 'to set up Wapaci?', W / 2, 416, { size: 46, weight: '700', alpha: f * pr(t, .4, 1.4) })
    txt(ctx, '?', W / 2, 600, { size: 200, color: '#38bdf8', weight: '900', alpha: f * pr(t, 1, 2.5) })
  }
  if (t >= 7 && t < 24) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 15 ? 1 - pr(lt, 15, 17) : 1
    const angle = -Math.PI / 2 + Math.PI * 2 * cl(lt / 13)
    ctx.save(); ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(W / 2, 430, 180, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(56,189,248,.15)'; ctx.lineWidth = 12; ctx.stroke()
    ctx.beginPath(); ctx.arc(W / 2, 430, 180, -Math.PI / 2, angle); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke()
    ctx.restore()
    const elapsed = Math.min(10, lt * (10 / 13))
    const mm = Math.floor(elapsed), ss = Math.round((elapsed % 1) * 60)
    txt(ctx, `${mm}:${ss.toString().padStart(2, '0')}`, W / 2, 420, { size: 96, color: '#38bdf8', weight: '900', alpha: f })
    txt(ctx, 'minutes', W / 2, 500, { size: 28, color: '#0369a1', weight: '600', alpha: f })
    const steps = [
      { s: 'Connect your Shopify store', t0: .5 },
      { s: 'Enable Cart Recovery flow', t0: 2.8 },
      { s: 'Set up COD Confirmation',   t0: 5.2 },
      { s: 'Launch Welcome Series',     t0: 7.8 },
      { s: 'All 5 automations: LIVE ✅',t0: 10.5 },
    ]
    steps.forEach((s, i) => {
      const sp = pr(lt, s.t0, s.t0 + .7)
      ctx.globalAlpha = f * sp
      rr(ctx, W / 2 - 245, 645 + i * 62, 490, 46, 10, i === 4 ? 'rgba(37,211,102,.15)' : 'rgba(56,189,248,.1)', i === 4 ? 'rgba(37,211,102,.5)' : 'rgba(56,189,248,.3)')
      txt(ctx, s.s, W / 2, 668 + i * 62, { size: 18, color: i === 4 ? '#25D366' : '#38bdf8', weight: i === 4 ? '800' : '600', alpha: f * sp })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 23) {
    const lt = t - 23, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '56,189,248', .2 * f)
    txt(ctx, '10 minutes to set up.', W / 2, 390, { size: 50, weight: '800', alpha: f })
    txt(ctx, 'Lifetime of revenue.', W / 2, 460, { size: 50, color: '#38bdf8', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 562, 410, 82, 41, '#38bdf8')
    txt(ctx, 'Start the 10-Min Setup →', W / 2, 603, { size: 25, color: '#000', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 704, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 18 — Emoji Reactions (colorful, floating emoji cartoon) */
function renderAd18(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#07060e'; ctx.fillRect(0, 0, W, H); grid(ctx)
  glow(ctx, W / 2, 600, 600, '168,85,247', .06 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    rr(ctx, 140, 340, 800, 200, 24, 'rgba(255,255,255,.05)', 'rgba(255,255,255,.1)')
    txt(ctx, '📦 Order Update!', W / 2, 406, { size: 30, weight: '700', alpha: f * pr(t, .3, 1.3) })
    txt(ctx, 'Your package is out for delivery 🚀', W / 2, 456, { size: 22, color: '#94a3b8', weight: '400', alpha: f * pr(t, .8, 1.8) })
    txt(ctx, '— Wapaci', W / 2, 510, { size: 18, color: '#475569', weight: '600', alpha: f * pr(t, 1.5, 2.5) })
    txt(ctx, 'How do customers feel?', W / 2, 720, { size: 32, weight: '700', alpha: f * pr(t, 3.5, 5.5) })
  }
  if (t >= 7 && t < 23) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 14 ? 1 - pr(lt, 14, 16) : 1
    const emojis = [
      { e: '😍', x: 160, delay: .3, color: '#f43f5e' },
      { e: '🔥', x: 350, delay: .9, color: '#f97316' },
      { e: '💯', x: 540, delay: 1.5, color: '#eab308' },
      { e: '🎉', x: 730, delay: 2.1, color: '#22c55e' },
      { e: '✨', x: 920, delay: 2.7, color: '#818cf8' },
      { e: '😱', x: 250, delay: 4,   color: '#ec4899' },
      { e: '💚', x: 450, delay: 4.6, color: '#25D366' },
      { e: '👏', x: 650, delay: 5.2, color: '#f59e0b' },
      { e: '🚀', x: 840, delay: 5.8, color: '#38bdf8' },
    ]
    emojis.forEach(em => {
      const ep = pr(lt, em.delay, em.delay + .5); if (ep <= 0) return
      const floatY = 800 - ep * 600 - lt * 30
      const fadeA = ep < .3 ? ep / .3 : floatY < 100 ? (floatY - 50) / 50 : 1
      txt(ctx, em.e, em.x, Math.max(50, floatY), { size: 80 + ep * 30, alpha: f * Math.max(0, fadeA) })
    })
    const msgs2 = [
      { t0: 7,   text: '"This brand actually cares! 🥰"' },
      { t0: 9.5, text: '"Best post-purchase experience ever!"' },
      { t0: 12,  text: '"Just ordered again. Second time this week 😅"' },
    ]
    msgs2.forEach(m => {
      const mp = pr(lt, m.t0, m.t0 + .8); if (mp <= 0) return
      rr(ctx, 130, 640, 820, 68, 18, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.12)')
      txt(ctx, m.text, W / 2, 674, { size: 22, color: '#e2e8f0', weight: '500', alpha: f * mp })
    })
  }
  if (t >= 22) {
    const lt = t - 22, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '168,85,247', .2 * f)
    txt(ctx, 'Make customers feel this.', W / 2, 380, { size: 50, weight: '800', alpha: f })
    txt(ctx, 'Every. Single. Time.', W / 2, 456, { size: 50, color: '#a78bfa', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 560, 410, 82, 41, '#7c3aed')
    txt(ctx, 'Create Happy Customers →', W / 2, 601, { size: 25, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 702, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 19 — The Proof (slate, stat grid) */
function renderAd19(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#040810'; ctx.fillRect(0, 0, W, H); grid(ctx)
  glow(ctx, W / 2, H / 2, 600, '148,163,184', .05 * cl(t / 2))

  if (t < 8) {
    const f = t < .8 ? pr(t, 0, .8) : t > 7 ? 1 - pr(t, 7, 8) : 1
    txt(ctx, 'The numbers', W / 2, 400, { size: 88, weight: '900', alpha: f * pr(t, 0, 1) })
    txt(ctx, "don't lie.", W / 2, 500, { size: 88, color: '#94a3b8', weight: '900', alpha: f * pr(t, .4, 1.4) })
  }
  if (t >= 7 && t < 24) {
    const lt = t - 7, f = lt < 1 ? pr(lt, 0, 1) : lt > 15 ? 1 - pr(lt, 15, 17) : 1
    const stats = [
      { v: '500+',  l: 'Indian D2C Brands',      c: '#f8fafc', t0: .3 },
      { v: '98%',   l: 'WhatsApp Open Rate',      c: '#25D366', t0: 1.2 },
      { v: '₹47L',  l: 'Avg Monthly Recovered',   c: '#eab308', t0: 2.1 },
      { v: '28%',   l: 'Cart Recovery Rate',       c: '#f97316', t0: 3 },
      { v: '47×',   l: 'Average ROI',              c: '#818cf8', t0: 3.9 },
      { v: '3 min', l: 'Avg Message Read Time',    c: '#38bdf8', t0: 4.8 },
    ]
    stats.forEach((s, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const sx = 120 + col * 300, sy = 270 + row * 300
      const sp = pr(lt, s.t0, s.t0 + .8); ctx.globalAlpha = f * sp
      rr(ctx, sx, sy, 270, 240, 22, 'rgba(255,255,255,.04)', 'rgba(255,255,255,.08)')
      txt(ctx, s.v, sx + 135, sy + 90, { size: 62, color: s.c, weight: '900', alpha: f * sp })
      txt(ctx, s.l, sx + 135, sy + 176, { size: 17, color: '#64748b', weight: '500', alpha: f * sp })
      ctx.globalAlpha = 1
    })
  }
  if (t >= 23) {
    const lt = t - 23, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 600, '148,163,184', .18 * f)
    txt(ctx, 'India\'s fastest-growing', W / 2, 390, { size: 46, weight: '700', alpha: f })
    txt(ctx, 'D2C brands trust Wapaci.', W / 2, 454, { size: 46, color: '#94a3b8', weight: '700', alpha: f })
    ctx.globalAlpha = f * pr(lt, .5, 1.5)
    rr(ctx, W / 2 - 205, 562, 410, 82, 41, '#475569')
    txt(ctx, 'See the Results for Yourself →', W / 2, 603, { size: 23, color: '#fff', weight: '800', alpha: f * pr(lt, .5, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 704, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 20 — Revenue Rocket (space, cartoon rocket) */
function renderAd20(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#01020a'; ctx.fillRect(0, 0, W, H)
  starfield(ctx, 120, t)
  glow(ctx, W / 2, H / 2, 600, '249,115,22', .06 * cl(t / 2))

  if (t < 9) {
    const f = t < .8 ? pr(t, 0, .8) : t > 8 ? 1 - pr(t, 8, 9) : 1
    rocketDraw(ctx, W / 2, 700, 120, f, t)
    txt(ctx, 'Your Revenue', W / 2, 880, { size: 32, color: '#94a3b8', weight: '600', alpha: f * pr(t, .3, 1.5) })
    txt(ctx, 'Before Wapaci', W / 2, 928, { size: 24, color: '#475569', weight: '500', alpha: f * pr(t, 1, 2.5) })
    txt(ctx, 'Still on the launchpad...', W / 2, 980, { size: 22, color: '#374151', weight: '400', alpha: f * pr(t, 3, 5) })
  }
  if (t >= 8 && t < 24) {
    const lt = t - 8, f = lt < 1 ? pr(lt, 0, 1) : lt > 14 ? 1 - pr(lt, 14, 16) : 1
    const rocketY = 900 - lt * 65
    rocketDraw(ctx, W / 2, Math.max(-100, rocketY), 120, f, t)
    for (let i = 0; i < 20; i++) {
      const py = rocketY + 80 + i * 30 + (t * 40) % 30
      const px = W / 2 + (Math.sin(i * 2.7 + t * 8) * 30)
      ctx.globalAlpha = f * Math.max(0, 1 - i * .06)
      ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#f97316'
      ctx.beginPath(); ctx.arc(px, py, 8 - i * .3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    const milestones = [
      { v: '₹5L/mo',  y: 820, t0: .8 },
      { v: '₹25L/mo', y: 570, t0: 4 },
      { v: '₹50L/mo', y: 330, t0: 7.5 },
      { v: '₹1Cr/mo', y: 100, t0: 11 },
    ]
    milestones.forEach(m => {
      const mp = pr(lt, m.t0, m.t0 + .7), yy = m.y
      if (mp <= 0 || rocketY > yy + 40) return
      ctx.globalAlpha = f * mp
      ctx.strokeStyle = 'rgba(249,115,22,.35)'; ctx.lineWidth = 1; ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(160, yy); ctx.lineTo(920, yy); ctx.stroke(); ctx.setLineDash([])
      rr(ctx, 620, yy - 24, 220, 48, 12, 'rgba(249,115,22,.15)', 'rgba(249,115,22,.45)')
      txt(ctx, m.v, 730, yy, { size: 22, color: '#f97316', weight: '800', alpha: f * mp })
      ctx.globalAlpha = 1
    })
    if (lt > 11) {
      burst(ctx, W / 2, 100, lt, 11, '#f97316', 30)
      burst(ctx, W / 2, 100, lt, 11, '#fbbf24', 20)
    }
  }
  if (t >= 23) {
    const lt = t - 23, f = lt < 1.5 ? pr(lt, 0, 1.5) : 1
    glow(ctx, W / 2, H / 2, 700, '249,115,22', .22 * f)
    txt(ctx, 'WhatsApp-Powered', W / 2, 370, { size: 56, color: '#f97316', weight: '900', alpha: f })
    txt(ctx, 'Revenue 🚀', W / 2, 450, { size: 56, weight: '900', alpha: f })
    txt(ctx, 'From launchpad to ₹1 crore/month.', W / 2, 540, { size: 28, color: '#92400e', weight: '500', alpha: f * pr(lt, .4, 1.4) })
    ctx.globalAlpha = f * pr(lt, .6, 1.5)
    rr(ctx, W / 2 - 210, 610, 420, 82, 41, '#f97316')
    txt(ctx, 'Launch With Wapaci →', W / 2, 651, { size: 26, color: '#fff', weight: '800', alpha: f * pr(lt, .6, 1.5) })
    txt(ctx, 'wapaci.com', W / 2, 752, { size: 24, color: '#475569', weight: '400', alpha: f * pr(lt, 1, 2) })
    ctx.globalAlpha = 1
  }
}

/* Ad 21 — The Cart Is Still Warm (real-time cart rescue) */
function renderAd21(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#050b12'; ctx.fillRect(0, 0, W, H)
  grid(ctx, 'rgba(37,211,102,.025)')
  glow(ctx, 170, 220, 560, '37,211,102', .07 * cl(t / 2))
  glow(ctx, 930, 860, 560, '14,165,233', .05 * cl(t / 2))

  if (t < 6) {
    const f = t < .6 ? pr(t, 0, .6) : t > 5 ? 1 - pr(t, 5, 6) : 1
    ctx.globalAlpha = f
    rr(ctx, 250, 245, 580, 68, 34, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.36)')
    txt(ctx, 'LIVE CART EVENT', W / 2, 279, { size: 18, color: '#25D366', weight: '900', alpha: f * pr(t, .1, .8) })
    const sec = Math.max(0, Math.round(12 - t * 2.1))
    txt(ctx, `${sec}s ago`, W / 2, 455, { size: 126, color: '#25D366', weight: '900', alpha: f * pr(t, .3, 1.1) })
    txt(ctx, 'someone almost bought from you.', W / 2, 560, { size: 38, color: '#dbeafe', weight: '700', alpha: f * pr(t, 1, 1.8) })
    rr(ctx, 220, 650, 640, 94, 22, 'rgba(239,68,68,.08)', 'rgba(239,68,68,.25)')
    txt(ctx, 'If you wait until tomorrow...', W / 2, 682, { size: 24, color: '#f87171', weight: '700', alpha: f * pr(t, 2.2, 3) })
    txt(ctx, 'that cart goes cold.', W / 2, 718, { size: 24, color: '#94a3b8', weight: '500', alpha: f * pr(t, 2.8, 3.7) })
    ctx.globalAlpha = 1
  }

  if (t >= 5.3 && t < 16.5) {
    const lt = t - 5.3, f = lt < .7 ? pr(lt, 0, .7) : lt > 10.2 ? 1 - pr(lt, 10.2, 11.2) : 1
    txt(ctx, 'Wapaci reacts while intent is still hot.', W / 2, 150, { size: 31, color: '#93c5fd', weight: '700', alpha: f * pr(lt, 0, 1) })
    const px = 125, py = 255, pw = 360, ph = 590
    ctx.globalAlpha = f
    rr(ctx, px, py, pw, ph, 40, '#101827', 'rgba(255,255,255,.1)', 2)
    rr(ctx, px, py, pw, 76, 40, '#075e54'); ctx.fillStyle = '#075e54'; ctx.fillRect(px, py + 38, pw, 38)
    ctx.beginPath(); ctx.arc(px + 45, py + 39, 24, 0, Math.PI * 2); ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, 'W', px + 45, py + 39, { size: 20, weight: '900', alpha: f })
    txt(ctx, 'Wapaci Recovery', px + 82, py + 33, { size: 18, weight: '800', align: 'left', alpha: f })
    txt(ctx, 'typing...', px + 82, py + 57, { size: 13, color: 'rgba(255,255,255,.65)', weight: '500', align: 'left', alpha: f })
    ctx.fillStyle = '#0b141a'; ctx.fillRect(px, py + 76, pw, ph - 76)

    const msgs = [
      { t0: .7, side: 'out', lines: ['Still thinking about', 'the sneakers, Aarav?'] },
      { t0: 2.6, side: 'out', lines: ['Your size is still reserved', 'for the next 15 minutes.'] },
      { t0: 4.8, side: 'in',  lines: ['Perfect timing 😅'] },
      { t0: 6.4, side: 'out', lines: ['Use WELCOME10', 'and checkout in one tap.'] },
      { t0: 8.4, side: 'in',  lines: ['Done. Ordered! ✅'] },
    ]
    let my = py + 100
    msgs.forEach(m => {
      const mp = pr(lt, m.t0, m.t0 + .55); if (mp <= 0) return
      const bw = 282, bh = 34 + m.lines.length * 24
      const bx = m.side === 'out' ? px + pw - bw - 14 : px + 14
      ctx.globalAlpha = f * mp
      rr(ctx, bx, my, bw, bh, 16, m.side === 'out' ? '#005c4b' : '#1f2c34')
      m.lines.forEach((l, i) => txt(ctx, l, bx + 14, my + 28 + i * 24, { size: 16, weight: '500', align: 'left', alpha: f * mp }))
      my += bh + 11
    })

    const steps = [
      { l: 'Cart detected', v: '0.2 sec', c: '#38bdf8', t0: .8 },
      { l: 'Message sent', v: '12 sec', c: '#25D366', t0: 2 },
      { l: 'Customer replied', v: '3 min', c: '#eab308', t0: 5 },
      { l: 'Revenue recovered', v: '₹8,999', c: '#25D366', t0: 8.3 },
    ]
    steps.forEach((s, i) => {
      const sp = pr(lt, s.t0, s.t0 + .65)
      const x = 565, y = 280 + i * 112
      ctx.globalAlpha = f * sp
      rr(ctx, x, y, 380, 82, 18, `${s.c}16`, `${s.c}55`)
      txt(ctx, s.l, x + 24, y + 28, { size: 17, color: '#94a3b8', weight: '600', align: 'left', alpha: f * sp })
      txt(ctx, s.v, x + 24, y + 57, { size: 28, color: s.c, weight: '900', align: 'left', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  if (t >= 15.5 && t < 25.5) {
    const lt = t - 15.5, f = lt < .8 ? pr(lt, 0, .8) : lt > 8.8 ? 1 - pr(lt, 8.8, 10) : 1
    txt(ctx, 'The money was already on your site.', W / 2, 260, { size: 36, weight: '800', alpha: f * pr(lt, 0, 1) })
    txt(ctx, 'Wapaci brings it back.', W / 2, 312, { size: 36, color: '#25D366', weight: '900', alpha: f * pr(lt, .4, 1.4) })
    const stats = [
      { v: '28%', l: 'cart recovery', s: 'while intent is hot' },
      { v: '98%', l: 'open rate', s: 'WhatsApp-first' },
      { v: '₹2.1L', l: 'avg monthly lift', s: 'per active brand' },
    ]
    stats.forEach((s, i) => {
      const sp = pr(lt, 1 + i * .45, 2 + i * .45)
      const x = 120 + i * 300
      ctx.globalAlpha = f * sp
      rr(ctx, x, 410, 260, 245, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.22)')
      txt(ctx, s.v, x + 130, 500, { size: 62, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, x + 130, 570, { size: 19, weight: '800', alpha: f * sp })
      txt(ctx, s.s, x + 130, 603, { size: 15, color: '#64748b', weight: '500', alpha: f * sp })
    })
    rr(ctx, 210, 745, 660, 76, 38, 'rgba(37,211,102,.12)', 'rgba(37,211,102,.38)')
    txt(ctx, 'Recover the cart before it goes cold.', W / 2, 783, { size: 26, color: '#d1fae5', weight: '800', alpha: f * pr(lt, 4, 5) })
    ctx.globalAlpha = 1
  }

  if (t >= 24.5) {
    const lt = t - 24.5, f = lt < .8 ? pr(lt, 0, .8) : 1
    glow(ctx, W / 2, H / 2, 680, '37,211,102', .22 * f)
    txt(ctx, 'Save warm carts.', W / 2, 385, { size: 66, weight: '900', alpha: f })
    txt(ctx, 'Automatically.', W / 2, 470, { size: 66, color: '#25D366', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .45, 1.25)
    rr(ctx, W / 2 - 220, 590, 440, 84, 42, '#25D366')
    txt(ctx, 'Try Wapaci Free →', W / 2, 632, { size: 28, color: '#00130a', weight: '900', alpha: f * pr(lt, .45, 1.25) })
    txt(ctx, 'wapaci.com', W / 2, 730, { size: 24, color: '#64748b', weight: '500', alpha: f * pr(lt, .9, 1.8) })
    ctx.globalAlpha = 1
  }
}

/* Ad 22 — COD Filter (confirm before you ship) */
function renderAd22(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#100804'; ctx.fillRect(0, 0, W, H)
  grid(ctx, 'rgba(249,115,22,.025)')
  glow(ctx, 180, 220, 600, '239,68,68', .07 * cl(t / 2))
  glow(ctx, 900, 860, 620, '37,211,102', .06 * cl(t / 2))

  if (t < 7) {
    const f = t < .6 ? pr(t, 0, .6) : t > 6 ? 1 - pr(t, 6, 7) : 1
    txt(ctx, 'Fake COD orders', W / 2, 310, { size: 66, color: '#fb923c', weight: '900', alpha: f * pr(t, .1, 1) })
    txt(ctx, 'do not just lose a sale.', W / 2, 390, { size: 36, color: '#fed7aa', weight: '700', alpha: f * pr(t, .8, 1.8) })
    const costs = [
      { v: 'Shipping', c: '#ef4444', t0: 1.5 },
      { v: 'RTO fee', c: '#f97316', t0: 2.2 },
      { v: 'Inventory stuck', c: '#eab308', t0: 2.9 },
    ]
    costs.forEach((c, i) => {
      const cp = pr(t, c.t0, c.t0 + .65)
      const x = 135 + i * 300
      ctx.globalAlpha = f * cp
      rr(ctx, x, 500, 250, 130, 20, `${c.c}18`, `${c.c}55`)
      txt(ctx, '✕', x + 125, 545, { size: 34, color: c.c, weight: '900', alpha: f * cp })
      txt(ctx, c.v, x + 125, 592, { size: 20, color: '#fff7ed', weight: '800', alpha: f * cp })
    })
    txt(ctx, 'You pay twice for a customer who was never serious.', W / 2, 735, { size: 27, color: '#9ca3af', weight: '600', alpha: f * pr(t, 4, 5) })
    ctx.globalAlpha = 1
  }

  if (t >= 6.2 && t < 17.5) {
    const lt = t - 6.2, f = lt < .8 ? pr(lt, 0, .8) : lt > 10 ? 1 - pr(lt, 10, 11.3) : 1
    txt(ctx, 'Wapaci confirms before dispatch.', W / 2, 160, { size: 34, color: '#fb923c', weight: '900', alpha: f * pr(lt, 0, 1) })
    rr(ctx, 90, 260, 900, 470, 34, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.09)')
    const orders = [
      { name: 'Order #1048', amt: '₹1,899', ans: 'YES', color: '#25D366', t0: .8 },
      { name: 'Order #1049', amt: '₹3,299', ans: 'NO', color: '#ef4444', t0: 2.4 },
      { name: 'Order #1050', amt: '₹999', ans: 'YES', color: '#25D366', t0: 4 },
      { name: 'Order #1051', amt: '₹4,499', ans: 'NO', color: '#ef4444', t0: 5.6 },
    ]
    orders.forEach((o, i) => {
      const op = pr(lt, o.t0, o.t0 + .65)
      const y = 305 + i * 88
      ctx.globalAlpha = f * op
      rr(ctx, 140, y, 330, 62, 16, 'rgba(251,146,60,.12)', 'rgba(251,146,60,.35)')
      txt(ctx, o.name, 165, y + 21, { size: 17, color: '#ffedd5', weight: '800', align: 'left', alpha: f * op })
      txt(ctx, o.amt, 165, y + 45, { size: 15, color: '#9ca3af', weight: '600', align: 'left', alpha: f * op })
      rr(ctx, 585, y, 170, 62, 31, `${o.color}22`, `${o.color}70`)
      txt(ctx, o.ans, 670, y + 31, { size: 28, color: o.color, weight: '900', alpha: f * op })
      const laneX = o.ans === 'YES' ? 825 : 890
      txt(ctx, o.ans === 'YES' ? 'Ship' : 'Stop', laneX, y + 31, { size: 20, color: o.color, weight: '800', alpha: f * op })
      ctx.globalAlpha = 1
    })
    ctx.globalAlpha = f * pr(lt, 7.5, 8.5)
    rr(ctx, 210, 790, 660, 86, 22, 'rgba(37,211,102,.12)', 'rgba(37,211,102,.38)')
    txt(ctx, 'Only confirmed COD orders leave your warehouse.', W / 2, 833, { size: 26, color: '#bbf7d0', weight: '900', alpha: f * pr(lt, 7.5, 8.5) })
    ctx.globalAlpha = 1
  }

  if (t >= 16.5 && t < 25.5) {
    const lt = t - 16.5, f = lt < .8 ? pr(lt, 0, .8) : lt > 7.8 ? 1 - pr(lt, 7.8, 9) : 1
    txt(ctx, 'The result:', W / 2, 250, { size: 34, color: '#fed7aa', weight: '800', alpha: f * pr(lt, 0, 1) })
    const stats = [
      { v: '-41%', l: 'RTO reduction', c: '#25D366' },
      { v: '₹84K', l: 'shipping saved', c: '#eab308' },
      { v: '+18%', l: 'COD confirmation', c: '#fb923c' },
    ]
    stats.forEach((s, i) => {
      const sp = pr(lt, .6 + i * .45, 1.6 + i * .45)
      const x = 120 + i * 300
      ctx.globalAlpha = f * sp
      rr(ctx, x, 360, 260, 250, 22, `${s.c}14`, `${s.c}46`)
      txt(ctx, s.v, x + 130, 458, { size: 60, color: s.c, weight: '900', alpha: f * sp })
      txt(ctx, s.l, x + 130, 530, { size: 20, color: '#fff7ed', weight: '800', alpha: f * sp })
    })
    rr(ctx, 190, 710, 700, 92, 24, 'rgba(249,115,22,.11)', 'rgba(249,115,22,.35)')
    txt(ctx, 'Stop shipping uncertainty.', W / 2, 746, { size: 28, color: '#fdba74', weight: '900', alpha: f * pr(lt, 4, 5) })
    txt(ctx, 'Send only what customers confirm.', W / 2, 780, { size: 22, color: '#9ca3af', weight: '600', alpha: f * pr(lt, 4.6, 5.6) })
    ctx.globalAlpha = 1
  }

  if (t >= 24.5) {
    const lt = t - 24.5, f = lt < .8 ? pr(lt, 0, .8) : 1
    glow(ctx, W / 2, H / 2, 680, '249,115,22', .2 * f)
    txt(ctx, 'Confirm COD.', W / 2, 382, { size: 66, color: '#fb923c', weight: '900', alpha: f })
    txt(ctx, 'Cut RTO waste.', W / 2, 468, { size: 66, color: '#25D366', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .45, 1.25)
    rr(ctx, W / 2 - 225, 592, 450, 84, 42, '#fb923c')
    txt(ctx, 'Automate COD on WhatsApp →', W / 2, 634, { size: 25, color: '#111827', weight: '900', alpha: f * pr(lt, .45, 1.25) })
    txt(ctx, 'wapaci.com', W / 2, 732, { size: 24, color: '#78716c', weight: '500', alpha: f * pr(lt, .9, 1.8) })
    ctx.globalAlpha = 1
  }
}

const RENDERERS: Record<number, (ctx: CanvasRenderingContext2D, t: number) => void> = {
  1: renderAd1, 2: renderAd2, 3: renderAd3,
  4: renderAd4, 5: renderAd5, 6: renderAd6, 7: renderAd7,
  8: renderAd8, 9: renderAd9, 10: renderAd10, 11: renderAd11,
  12: renderAd12, 13: renderAd13, 14: renderAd14, 15: renderAd15,
  16: renderAd16, 17: renderAd17, 18: renderAd18, 19: renderAd19,
  20: renderAd20, 21: renderAd21, 22: renderAd22,
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

Try Wapakee free today — wapaki dot com!`,
    voiceDir: 'serious and slow dramatic opening with heavy pauses, build suspense, then suddenly shift to excited and energetic when revealing the solution, warm and enthusiastic close',
    expertScript: `Right now...

Seventy percent of your customers...

...are leaving.

Without buying.

A single thing.

That is real money. Walking out the door.

Every. Single. Day.

And you...

You have absolutely no way to bring them back.

...

Until now.

Wapakee sends them a WhatsApp message — automatically. At exactly the right moment.

And here is what happens next?

Twenty-eight percent...

...come BACK.

Twenty-eight percent of your abandoned carts — recovered. Every month. On autopilot.

Your competitors are already doing this.

Don't get left behind.

Try Wapakee free today — wapaki dot com.`,
    expertVoiceDir: `Warm Indian female voice, English only. Start in a slow near-whisper that builds dread — like sharing a dark secret. Hold a full two-second silence after the word 'customers' and again after 'leaving'. Deliver 'Without buying. A single thing.' with heavy broken weight — each phrase lands separately, like a gut punch. Drop almost to silence before 'Until now' — then shift completely into warmth, brightness, relief — like a friend who just found the answer. Build confident energy through the WhatsApp explanation. Land 'come BACK' with explosive triumph and genuine joy — this is the emotional peak of the ad. Close with urgent warmth, like a mentor who sincerely wants you to win.`,
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
    expertScript: `What...

...if I told you...

Five lakh rupees of abandoned carts...

Could become...

...one point four lakh in recovered revenue?

That is not a pitch.

That is the MATH.

WhatsApp open rate?

Ninety-eight percent.

Nine. Eight. Percent.

Read in under three minutes.

Forty-five percent of customers... actually reply back.

That is forty-seven times your investment.

Every. Single. Month.

The math is simple.

The setup?

Ten minutes.

Your competitors are already using this.

The results speak for themselves.

Start your free trial at Wapakee dot com — today.`,
    expertVoiceDir: `Confident, clear Indian female voice speaking English only. Open slowly with genuine wonder and curiosity — like you are about to share something that completely changed things for you. Slow way down on the numbers — each one must land with physical weight, as if you are writing it in the air. Pause a full second after 'Nine. Eight. Percent.' and let the listener absorb it. Middle section: warm and conversational, like a smart friend who did the math so you didn't have to. Build to controlled electricity at 'forty-seven times your investment' — not shouting, but thrilling and alive. Close with deep conviction — like someone who has seen these results personally and cannot believe more people don't know about this yet.`,
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

Try it free today — wapaki dot com!`,
    voiceDir: 'start very slow and deliberate, long dramatic silence between each stat, explosive excitement on the WhatsApp reveal, thoughtful pause then warm confident close',
    expertScript: `Quick question.

Which channel...

...do your customers actually read?

Email?

...

Two percent open rate.

...

SMS?

...

Five percent.

...

WhatsApp?

NINETY. EIGHT. PERCENT.

...

Let that sink in.

Your customers are on WhatsApp.

They read messages in under three minutes.

And almost HALF of them...

...reply.

Stop sending emails nobody opens.

Start sending WhatsApp messages that actually convert.

Wapakee — WhatsApp automation for Indian D two C brands.

Try it free today — wapaki dot com.`,
    expertVoiceDir: `Sharp, intelligent Indian female voice speaking fluent English only. Open with playful provocative energy — a question that dares the listener to think. After 'actually read' hold a full two-second silence. Deliver 'Two percent' with quiet almost-sad disappointment — trailing off like reading a bad report card. Same tone for 'Five percent' — even quieter, even sadder. Then one full beat of complete silence. Then EXPLODE on 'Ninety. Eight. Percent.' — maximum energy, genuine excitement, as if this number personally thrills you every single time you say it. Land 'Let that sink in' as a slow near-whisper — drop the energy completely, the eye of the storm. Then build steadily back through the solution section. Close sharp, authoritative, and confident — like someone who knows exactly what she's talking about and has no doubt.`,
  },
  {
    id: 4, filename: 'wapaci-dead-hours',
    title: 'Dead Hours — Midnight Revenue',
    tag: 'Problem-Centric', tagColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    accent: '#6366f1',
    defaultScript: `What happens to your store... after midnight?

Your customers don't stop browsing at eleven pm. They scroll at two in the morning. They abandon carts at three am. They have questions... at four am.

And your team? Fast asleep.

Every single hour that passes without a follow-up... that customer forgets you existed.

Wapakee never sleeps.

It sends WhatsApp messages automatically... the moment your customer shows intent. No matter what time it is. No matter what day it is.

Your competitor is already following up at midnight. While you sleep, they're recovering carts.

Set up Wapakee once.

And your store never has dead hours again.

Try it free — wapaki dot com!`,
    voiceDir: 'slow mysterious opening, build a cinematic late-night feeling, serious and atmospheric, then shift to confident and energizing when revealing the solution, warm closing',
  },
  {
    id: 5, filename: 'wapaci-98-percent-club',
    title: '98% Club — Open Rate Shock',
    tag: 'Problem-Centric', tagColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accent: '#f59e0b',
    defaultScript: `You sent that email last week.

Spent two hours writing it. Got your designer to make it beautiful. Hit send to fifteen thousand customers.

How many opened it?

Three hundred. Maybe four hundred.

That's two percent.

Two percent of the people you worked so hard to reach... actually saw your message.

Now here's what happens when Wapakee sends a WhatsApp instead.

Ninety. Eight. Percent.

Fourteen thousand seven hundred people. Reading your message. In under three minutes.

That is forty-nine times more reach. For the same effort.

The same customers. The same message. Forty-nine times the impact.

WhatsApp is where India shops.

Join the ninety-eight percent club.

Start free at wapaki dot com!`,
    voiceDir: 'conversational and relatable opening, pause hard after the two percent reveal, then build to absolute amazement at the ninety-eight percent stat, upbeat and motivating close',
  },
  {
    id: 6, filename: 'wapaci-cod-recovery',
    title: 'COD Recovery — Stop the Returns',
    tag: 'Problem-Centric', tagColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    accent: '#f97316',
    defaultScript: `Every time a fake COD order ships...

You pay for packaging. You pay for the courier. You pay for return logistics. And the product comes back damaged, unsellable.

One fake COD doesn't hurt much.

But fifty a month? A hundred? It's quietly killing your margins.

Wapakee stops fake COD orders before they ship.

The moment a COD order is placed... Wapakee sends the customer a WhatsApp confirmation.

One tap to confirm. One tap to cancel.

No confirmation? Wapakee follows up automatically. Twice. Three times.

Only confirmed orders leave your warehouse.

Your RTO rate drops. Your team stops wasting hours. Your margins recover.

Stop shipping to people who never intended to buy.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'sharp and direct, urgent pacing on the pain points, matter-of-fact businesslike tone, confident and decisive when presenting the solution, punchy close',
  },
  {
    id: 7, filename: 'wapaci-ghost-customers',
    title: 'Ghost Customers — They Were There',
    tag: 'Problem-Centric', tagColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    accent: '#a855f7',
    defaultScript: `They visited your store. They browsed three products. They even added one to the cart.

And then... they vanished.

No purchase. No message. Nothing.

These aren't lost customers. These are ghost customers.

They were interested. They just needed one more nudge.

But you never gave it to them because you had no way to reach them.

Until Wapakee.

The moment a customer ghosts your cart... Wapakee appears in their WhatsApp. With the exact product they left behind. With a personalized message. With just enough reason to come back.

Ghosts don't buy. Engaged customers do.

Turn your ghost customers into real revenue.

Try Wapakee free today — wapaki dot com!`,
    voiceDir: 'playful and slightly mysterious opening, build intrigue around the ghost metaphor, then shift to warm and confident for the solution reveal, energetic and fun close',
  },
  {
    id: 8, filename: 'wapaci-leaky-bucket',
    title: 'Leaky Bucket — Plug the Revenue Holes',
    tag: 'Problem-Centric', tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    accent: '#3b82f6',
    defaultScript: `Imagine filling a bucket with water...

But the bucket has holes in the bottom.

That's your e-commerce store right now.

Money flows in from your ads. From your SEO. From your influencers.

And it leaks out through abandoned carts. Unconfirmed COD orders. Customers who ordered once... and never came back.

You're spending more and more to fill a leaky bucket.

Wapakee plugs the holes.

Cart abandonment? Automatic WhatsApp follow-up.

COD fraud? Confirmation message before it ships.

One-time buyers? Win-back campaigns that bring them back.

Stop pouring money into a leaky funnel.

Plug the holes. Keep the revenue.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'calm and analytical opening with the bucket metaphor, slow build as the problems are listed, then energetic and solution-focused, confident closing with a sense of relief',
  },
  {
    id: 9, filename: 'wapaci-flash-sale-blast',
    title: 'Flash Sale Blast — Sell Out in Minutes',
    tag: 'Solution-Centric', tagColor: 'bg-red-500/20 text-red-400 border-red-500/30',
    accent: '#ef4444',
    defaultScript: `You have a flash sale starting in two hours.

How do you tell twenty thousand customers?

Email? Half of them won't see it for three days.

Instagram? Your algorithm reach is maybe five percent.

SMS? Most people don't even open promotional texts anymore.

WhatsApp?

Ninety-eight percent open rate. Read in under three minutes.

Wapakee broadcasts your flash sale to every customer... at exactly the moment you choose. With a personalized message. With a direct link to your store.

Twenty thousand messages. Delivered. Read. Acted on.

Your competitors are selling out in minutes while you're still waiting for your email to land.

Don't run another flash sale without Wapakee.

Try it free — wapaki dot com!`,
    voiceDir: 'fast and urgent opening, build excitement and energy throughout, make each channel comparison land with increasing impact, explosive and enthusiastic for the WhatsApp reveal, rally-cry close',
  },
  {
    id: 10, filename: 'wapaci-order-delight',
    title: 'Order Delight — Every Step Counts',
    tag: 'Solution-Centric', tagColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    accent: '#14b8a6',
    defaultScript: `Order confirmed.

Packed and dispatched.

Out for delivery.

Delivered.

Four messages. That's all it takes to turn a nervous customer into a loyal fan.

Most D2C brands give customers... nothing. No updates. No tracking messages. Just silence until a package appears at the door.

And customers hate that silence.

Wapakee sends every order update directly to WhatsApp. In real time. Automatically.

Customers know exactly where their order is. They feel taken care of. They trust your brand more.

And that trust? It turns first-time buyers into repeat customers.

Delight your customers at every step.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'warm and deliberate opening reading out the order stages, conversational and empathetic through the pain point, then warm and reassuring for the solution, genuine and caring close',
  },
  {
    id: 11, filename: 'wapaci-win-back',
    title: 'Win-Back — They Chose You Once',
    tag: 'Solution-Centric', tagColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    accent: '#06b6d4',
    defaultScript: `Somewhere in your customer list... there are people who loved your product.

They bought once. They left a good review. They even told a friend.

And then... they disappeared.

Not because they stopped liking you. Life got busy. They forgot. No one reminded them you existed.

These are your easiest customers to win back.

Wapakee identifies customers who haven't bought in sixty, ninety, or a hundred and twenty days... and automatically reaches out on WhatsApp with a personalized message.

A gentle nudge. A special offer. A reminder of why they chose you.

Thirty percent of win-back messages result in a repurchase.

The sale is already there. You just have to show up.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'nostalgic and warm opening, slightly melancholic but hopeful, build emotional connection, then shift to confident and optimistic for the solution, heartfelt and genuine close',
  },
  {
    id: 12, filename: 'wapaci-testimonial-wall',
    title: 'Testimonial Wall — Let Customers Sell',
    tag: 'Solution-Centric', tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    accent: '#22c55e',
    defaultScript: `Your best salesperson isn't on your team.

It's your happiest customer.

But how do you get them to speak up?

Most brands send a review email. It goes to spam. Open rate? Two percent.

Wapakee sends a review request on WhatsApp... the day after delivery, when the excitement is still fresh.

Ninety-eight percent open rate. Customers actually respond.

And here's the magic.

Happy customers write five-star reviews. They share photos. They send voice notes.

Wapakee collects it all. Automatically.

Your testimonials grow on autopilot. Your social proof stacks up. New customers trust your brand before they've even met you.

Let your happiest customers do the selling.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'warm and conversational, like sharing a secret, build curiosity and contrast with the old way, then enthusiastic and bright for the WhatsApp reveal, empowering and uplifting close',
  },
  {
    id: 13, filename: 'wapaci-automation-stack',
    title: 'Automation Stack — Set It, Forget It',
    tag: 'Solution-Centric', tagColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    accent: '#6366f1',
    defaultScript: `What if your entire WhatsApp marketing stack ran... on its own?

No manual messages. No copy-pasting. No team sitting at midnight sending follow-ups.

Just flows that work around the clock.

Customer abandons cart? Automated message.

COD order needs confirmation? Automated message.

Order ships? Automated update.

Customer goes quiet for sixty days? Automated win-back.

Flash sale tomorrow? Schedule it once. It sends to everyone.

Wapakee is the automation layer your D2C brand has been missing.

One platform. Every flow. Running twenty-four-seven.

Set up your first automation in ten minutes.

Your competitors built this stack six months ago.

Don't wait any longer.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'calm and confident, like a knowledgeable expert revealing a system, crisp and rhythmic pacing as you list the flows, build momentum, then compelling and authoritative close',
  },
  {
    id: 14, filename: 'wapaci-crore-club',
    title: '₹1 Crore Club — Join Them',
    tag: 'Solution-Centric', tagColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    accent: '#eab308',
    defaultScript: `Fifty-three Indian D2C brands crossed one crore rupees in monthly revenue last quarter.

What did they have in common?

None of them relied on email.

None of them were praying for Instagram reach.

Every single one had WhatsApp automation running in the background. Recovering carts. Confirming COD orders. Sending review requests. Running flash sales.

While their owners slept... Wapakee worked.

That's the difference between a five lakh a month brand and a one crore a month brand.

Not better products. Not bigger ad budgets.

Better WhatsApp automation.

Your next crore is already in your customer list.

Wapakee helps you collect it.

Try it free today — wapaki dot com!`,
    voiceDir: 'authoritative and impressive opening, build with conviction, make the contrast between email and WhatsApp feel decisive, triumphant and aspirational close that feels achievable',
  },
  {
    id: 15, filename: 'wapaci-competitors-secret',
    title: "Competitor's Secret — They Know Something",
    tag: 'Problem-Centric', tagColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    accent: '#f43f5e',
    defaultScript: `Your competitor launched the same product as you... six months ago.

Same price. Same quality. Same target audience.

They're now doing ten times your revenue.

You've been trying to figure out why.

Here's their secret.

While you were sending emails nobody opened... they were sending WhatsApp messages with a ninety-eight percent open rate.

While you were manually following up with cart abandoners... they had Wapakee doing it automatically at the right time.

While you were losing COD orders to fraud... they were confirming every order before shipping.

The product isn't the difference. The channel is.

Your competitor found Wapakee before you did.

Don't let them stay ahead.

Try Wapakee free today — wapaki dot com!`,
    voiceDir: 'mysterious and intriguing opening that creates tension, build suspense and curiosity, then reveal with confident insider energy, urgent and slightly competitive close',
  },
  {
    id: 16, filename: 'wapaci-broadcast-power',
    title: 'Broadcast Power — Reach Everyone at Once',
    tag: 'Solution-Centric', tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    accent: '#10b981',
    defaultScript: `You built a customer list of thirty thousand people.

That list is worth crores.

But are you using it?

Most brands barely touch their customer list. The occasional email blast. A weak SMS campaign. And hope for the best.

Wapakee lets you broadcast directly to WhatsApp.

Personalized messages. Right name. Right product. Right timing.

Thirty thousand messages sent. Twenty-nine thousand opened. Within three minutes.

No other channel gives you that.

New product launch? Broadcast it.

Flash sale in two hours? Broadcast it.

Seasonal offer? Broadcast it.

Your customer list is your most valuable asset.

Wapakee helps you unlock it.

Try it free — wapaki dot com!`,
    voiceDir: 'confident and business-focused, build the value of the customer list, then excited and emphatic on the WhatsApp open rates, rhythmic and energetic through the broadcast examples, powerful close',
  },
  {
    id: 17, filename: 'wapaci-ten-minute-setup',
    title: 'Ten Minute Setup — Running Today',
    tag: 'Solution-Centric', tagColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    accent: '#0ea5e9',
    defaultScript: `How long does it take to set up WhatsApp automation for your store?

Most brands think... months. Custom dev. API integrations. A tech team.

With Wapakee?

Ten minutes.

Minute one: connect your store.

Minute three: pick your automations.

Minute seven: customize your messages.

Minute ten: go live.

No coding. No developers. No meetings.

From zero to fully automated WhatsApp marketing... in ten minutes.

Cart recovery? Running.

COD confirmation? Running.

Order updates? Running.

Win-back flows? Running.

Your entire retention engine. Live. Today.

Not next month. Not after you hire someone.

Today.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'energetic and upbeat from the start, crisp and satisfying rhythm through the minute-by-minute breakdown, build genuine excitement, powerful and motivating close with emphasis on today',
  },
  {
    id: 18, filename: 'wapaci-emoji-reactions',
    title: 'Emoji Reactions — Messages They Love',
    tag: 'Solution-Centric', tagColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    accent: '#ec4899',
    defaultScript: `What's the difference between a message people ignore... and one they actually love?

Personality.

Most brand messages are cold. Corporate. Boring.

Your customer ordered a birthday dress. Your WhatsApp message says: "Order confirmed. Expected delivery four to five business days."

That's not a brand. That's a machine.

Wapakee lets you write messages that feel human. With warmth. With excitement. With the energy of a brand that actually cares.

"Your birthday dress is on its way! Can't wait for you to wear it!"

Same information. Completely different feeling.

Customers screenshot messages like that. They share them. They remember your brand.

Messages that feel human... create customers who feel loyal.

Try Wapakee free — wapaki dot com!`,
    voiceDir: 'warm and personable from the first word, playful contrast between cold and warm messaging, genuinely excited and enthusiastic for the good example message, genuine and heartfelt close',
    expertScript: `You sent her an order confirmation.

She wanted to feel something.

Wapakee lets you write messages that feel human.

Messages that get screenshotted.

Shared.

Remembered.

Because customers who feel something...

come back.

Try Wapakee free. Wapaki dot com.`,
    expertVoiceDir: `Warm, expressive Indian female voice. English only. You have 9 lines. Take your time. Silence is part of the performance — do NOT rush.

"You sent her an order confirmation." — quiet, almost disappointed. Like watching someone miss a moment. Slow.

"She wanted to feel something." — pause after this. A full breath. Let it sit. This line is the whole point.

"Wapakee lets you write messages that feel human." — shift completely. Warm, confident, like the answer just walked in. Smile in your voice.

"Messages that get screenshotted." — pause. "Shared." — pause. "Remembered." — pause after each word. Three separate moments. Not a list. Let each one land.

"Because customers who feel something..." — slow down here. Build. The ellipsis is a real pause.

"come back." — land this quietly. Certain. Final. Like a fact you've seen a hundred times. No drama. Just truth.

"Try Wapakee free. Wapaki dot com." — warm and direct. You've already earned it.`,
  },
  {
    id: 19, filename: 'wapaci-the-proof',
    title: 'The Proof — Numbers Don\'t Lie',
    tag: 'Solution-Centric', tagColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    accent: '#64748b',
    defaultScript: `Let's skip the pitch. Here are the numbers.

WhatsApp open rate? Ninety-eight percent.

Email open rate? Two percent.

WhatsApp read time? Under three minutes.

Email read time? If it's ever opened... hours later.

Cart recovery rate with Wapakee? Twenty-eight percent of abandoned carts recovered.

Cart recovery rate without it? Zero.

COD confirmation rate? Sixty-seven percent of unconfirmed orders confirm after a WhatsApp message.

Win-back campaign response rate? Thirty percent of lapsed customers repurchase.

These aren't projections. These are averages across Indian D2C brands using Wapakee today.

The math is simple. The setup is ten minutes. The results are real.

Start your free trial at wapaki dot com.`,
    voiceDir: 'confident and measured, let each stat land with weight and a brief pause, speak like someone presenting undeniable evidence, serious and credible throughout, matter-of-fact but compelling close',
    expertScript: `WhatsApp. Ninety-eight percent open rate.

Email. Two percent.

Twenty-eight percent of abandoned carts... recovered.

Not a pitch.

Real numbers. Real brands. Right now.

Start free at Wapakee dot com.`,
    expertVoiceDir: `Calm, authoritative Indian female voice. English only. No warmup. No intro. Lead with the numbers like they're facts carved in stone. You have 6 lines. Go slow. Every pause earns its keep.

"WhatsApp. Ninety-eight percent open rate." — say each word like you're placing it on a table in front of them. Deliberate. Pause after.

"Email. Two percent." — flat. Almost pitying. No drama. The silence after this line does all the work. Hold it.

"Twenty-eight percent of abandoned carts... recovered." — slow down on 'recovered'. Land it like money appearing in an account. The ellipsis is a real pause — hold it.

"Not a pitch." — firm. Short. Make eye contact through the mic. Pause.

"Real numbers. Real brands. Right now." — each phrase separate, each one heavier than the last. Not fast. Punchy but deliberate.

"Start free at Wapakee dot com." — calm, certain. You've already won the argument. This is just the obvious next step.`,
  },
  {
    id: 20, filename: 'wapaci-revenue-rocket',
    title: 'Revenue Rocket — Blast Off',
    tag: 'Solution-Centric', tagColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    accent: '#8b5cf6',
    defaultScript: `Every rocket needs three things.

Fuel. Direction. Ignition.

Your D2C brand already has fuel. Your products. Your customers. Your ambition.

Direction? WhatsApp. The channel ninety-eight percent of India checks every single day.

Ignition? That's Wapakee.

Wapakee connects your store to WhatsApp automation in ten minutes. Cart recovery. COD confirmation. Order updates. Win-back campaigns. Flash sale broadcasts.

Everything fires automatically. Everything runs on rocket fuel.

Brands using Wapakee see two to four times the revenue from their existing customer base. No extra ad spend. Just better automation.

Your rocket is on the launchpad.

The countdown has started.

Ignite your revenue with Wapakee.

Try it free — wapaki dot com!`,
    voiceDir: 'cinematic and epic from the first word, deliberate and weighty on the three things, build momentum and energy steadily, reach a thrilling peak at the launch metaphor, triumphant and inspiring close',
    expertScript: `Every rocket needs three things.

Fuel. Direction. Ignition.

Your brand has the fuel.

WhatsApp is the direction.

Wapakee...

is the ignition.

Two to four times the revenue. No extra ad spend.

Wapakee dot com. Light the fuse.`,
    expertVoiceDir: `Cinematic, powerful Indian female voice. English only. You are a launch director. You have 8 lines. Build from cold commanding to full ignition. Take your time — this ad earns its silence.

"Every rocket needs three things." — slow, deliberate, like opening a strategy briefing. Pause after. Make them wait.

"Fuel. Direction. Ignition." — three separate breaths. Each word is its own moment. "Fuel" — grounded. "Direction" — rising slightly. "Ignition" — sharp, like striking a match. Pause after each word.

"Your brand has the fuel." — warm, validating. Directed at them personally.

"WhatsApp is the direction." — clean, certain.

"Wapakee..." — pause here. Real pause. Build the tension.

"is the ignition." — say this like handing someone the key. Quiet confidence. This is the reveal.

"Two to four times the revenue. No extra ad spend." — land each phrase like a headline. Pause between them. "No extra ad spend" — almost conspiratorial, like you're giving them a secret.

"Wapakee dot com. Light the fuse." — triumphant but controlled. End with energy, not shouting.`,
  },
  {
    id: 21, filename: 'wapaci-warm-cart',
    title: 'Warm Cart Rescue — Real-Time Intent',
    tag: 'High Intent', tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    accent: '#25D366',
    defaultScript: `Someone almost bought from you...
twelve seconds ago.

The cart is still warm.
The intent is still alive.

But every minute you wait...
that customer forgets.

Wapakee reacts instantly.
It detects the abandoned cart,
sends a WhatsApp message,
reserves the product,
and gives the customer one clear reason to finish checkout.

No manual follow-up.
No cold email.
No lost intent.

Just the right message...
while they still want to buy.

Save warm carts automatically.
Try Wapakee free today — wapaki dot com!`,
    voiceDir: 'urgent, cinematic, crisp Indian ecommerce ad voice; pause hard after the first line, then build speed and confidence; make the cart is still warm feel important; energetic CTA',
    expertScript: `Someone almost bought from you.

Twelve seconds ago.

The intent is still alive.

But every minute you wait...

they forget.

Wapakee sends the message. Instantly.

No lost sale.

Try Wapakee free. Wapaki dot com.`,
    expertVoiceDir: `Urgent, cinematic Indian female voice. English only. You have 8 lines. Open barely above a whisper — do not rush a single word. This ad lives in its pauses.

"Someone almost bought from you." — hushed. Intimate. Like telling a secret to one person. Slow.

"Twelve seconds ago." — sharp and precise. Like a timer going off. Short pause after.

"The intent is still alive." — careful, almost reverent. Like holding something fragile that could break. Slower than you think.

"But every minute you wait..." — build dread here. Each word heavier than the last. The ellipsis is a real pause — hold it. Let them feel the time passing.

"they forget." — quiet. Flat. Final. Like watching something slip away. Do not rush away from this line.

"Wapakee sends the message. Instantly." — complete pivot. Sharp, decisive, confident. Like a switch being flipped. "Instantly" lands clean.

"No lost sale." — quiet satisfaction. Short. Let it breathe.

"Try Wapakee free. Wapaki dot com." — warm, clear, energetic. You've earned this CTA.`,
  },
  {
    id: 22, filename: 'wapaci-cod-filter',
    title: 'COD Filter — Confirm Before You Ship',
    tag: 'COD/RTO', tagColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    accent: '#fb923c',
    defaultScript: `Fake COD orders don't just waste your time.

They cost you shipping.
RTO fees.
Inventory delays.
And angry operations teams.

Wapakee fixes this before the package leaves your warehouse.

Every COD buyer gets a WhatsApp confirmation.
Yes means ship it.
No means stop it.
No reply means follow up automatically.

So your team ships only serious orders.

Less RTO.
Less wasted cash.
More confirmed revenue.

Confirm COD on WhatsApp.
Try Wapakee free today — wapaki dot com!`,
    voiceDir: 'direct, sharp, business-focused Indian founder tone; serious on the pain, confident on the solution, punchy pacing, strong closing CTA',
    expertScript: `Every fake COD order costs you money you'll never get back.

Wapakee sends a WhatsApp before your package ships.

Yes — ship it.

No — stop it.

Less RTO. More real revenue.

Try Wapakee free. Wapaki dot com.`,
    expertVoiceDir: `Direct, sharp Indian female voice. English only. You have 6 lines. No warmup. No filler. You are talking to a founder who is losing money right now.

"Every fake COD order costs you money you'll never get back." — open serious and direct, like reading out a bill they didn't expect. Slow down on "you'll never get back." Land it. Pause after.

"Wapakee sends a WhatsApp before your package ships." — confident pivot. Clean. Relief in your voice. This is the fix.

"Yes — ship it." — sharp. Decisive. Short pause after.

"No — stop it." — even sharper. Like flipping a switch. Pause after. These two lines are punches. Let them land separately.

"Less RTO. More real revenue." — staccato. Two punches. "Less RTO" — pause. "More real revenue." — heavier, land this like money hitting the table.

"Try Wapakee free. Wapaki dot com." — direct, confident, final. No fluff. They already know they need this.`,
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
  // Per-ad download state — each ad tracks its own, so multiple can encode in parallel
  type AdDlPhase = 'idle' | 'encoding' | 'done'
  type ExpertPhase = 'idle' | 'generating' | 'encoding' | 'done' | 'error'
  const [adDls,      setAdDls]      = useState<Record<number, { phase: AdDlPhase; pct: number }>>({})
  const [expertAdDls, setExpertAdDls] = useState<Record<number, { phase: ExpertPhase; pct: number; error: string | null; label: string }>>({})

  const getAdDl      = (id: number) => adDls[id]      ?? { phase: 'idle' as AdDlPhase, pct: 0 }
  const getExpertAdDl = (id: number) => expertAdDls[id] ?? { phase: 'idle' as ExpertPhase, pct: 0, error: null, label: '' }

  const patchAdDl      = (id: number, p: Partial<{ phase: AdDlPhase; pct: number }>) =>
    setAdDls(prev => ({ ...prev, [id]: { ...getAdDl(id), ...p } }))
  const patchExpertAdDl = (id: number, p: Partial<{ phase: ExpertPhase; pct: number; error: string | null; label: string }>) =>
    setExpertAdDls(prev => ({ ...prev, [id]: { ...getExpertAdDl(id), ...p } }))

  // Two canvas refs per ad: preview (visible in card) and record (offscreen, always mounted)
  const previewRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const recordRefs  = useRef<Record<number, HTMLCanvasElement | null>>({})

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

  /* ── Trigger browser download from a Blob ── */
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${filename}.mp4`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 15_000)
  }

  /* ── WebCodecs encoder — renders all frames offline, returns a Blob ── */
  async function fastEncodeToBlob(
    recordCanvas: HTMLCanvasElement,
    renderer: (ctx: CanvasRenderingContext2D, t: number) => void,
    adId: number,
    audioBlob: Blob | null,
    onProgress: (pct: number) => void,
  ): Promise<Blob> {
    const SR = 48000, CH = 2, FPS = 30, TOTAL_FRAMES = DUR * FPS

    // ── Audio: render with OfflineAudioContext (near-instant) ──
    const offCtx = new OfflineAudioContext(CH, Math.ceil(SR * DUR), SR)
    const offMaster = offCtx.createGain(); offMaster.gain.value = 0.9
    offMaster.connect(offCtx.destination)

    if (audioBlob) {
      try {
        const buf = await offCtx.decodeAudioData(await audioBlob.arrayBuffer())
        const src = offCtx.createBufferSource(); src.buffer = buf
        const vg  = offCtx.createGain(); vg.gain.value = 1.8
        src.connect(vg); vg.connect(offMaster); src.start(0.15)
      } catch (e) { console.warn('audio decode:', e) }
    }
    scheduleAdAudio(offCtx as unknown as AudioContext, offMaster as unknown as GainNode, adId)
    const rendered = await offCtx.startRendering()

    // ── Set up mp4-muxer ──
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
    const target = new ArrayBufferTarget()
    const muxer  = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: 'aac', sampleRate: SR, numberOfChannels: CH },
      firstTimestampBehavior: 'offset',
      fastStart: 'in-memory',
    })

    // ── VideoEncoder — H.264 High at 12 Mbps (top notch for 1080p social media) ──
    const vEnc = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
      error:  e => { throw e },
    })
    vEnc.configure({ codec: 'avc1.4D0028', width: W, height: H, bitrate: 12_000_000, framerate: FPS })

    // ── AudioEncoder (AAC, 320 kbps) ──
    const aEnc = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta!),
      error:  e => { throw e },
    })
    aEnc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: CH, bitrate: 320_000 })

    // ── Encode video frames as fast as possible ──
    const rCtx = recordCanvas.getContext('2d')!
    for (let i = 0; i <= TOTAL_FRAMES; i++) {
      renderer(rCtx, i / FPS)
      const vf = new VideoFrame(recordCanvas, {
        timestamp: Math.round((i / FPS) * 1_000_000),
        duration:  Math.round(1_000_000 / FPS),
      })
      vEnc.encode(vf, { keyFrame: i % (FPS * 3) === 0 })
      vf.close()

      // Yield every 45 frames — keeps UI responsive without heavy task overhead
      if (i % 45 === 0) {
        onProgress(Math.round((i / TOTAL_FRAMES) * 100))
        await new Promise<void>(r => setTimeout(r, 0))
      }
    }
    await vEnc.flush()

    // ── Encode audio (f32-planar from OfflineAudioContext) ──
    const L = rendered.getChannelData(0)
    const R = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : L
    const planar = new Float32Array(L.length + R.length)
    planar.set(L, 0); planar.set(R, L.length)
    const audioData = new AudioData({
      format: 'f32-planar', sampleRate: SR, numberOfFrames: rendered.length,
      numberOfChannels: CH, timestamp: 0, data: planar,
    })
    aEnc.encode(audioData); audioData.close()
    await aEnc.flush()

    // ── Finalize ──
    muxer.finalize()
    return new Blob([target.buffer], { type: 'video/mp4' })
  }

  /* ── Thin wrapper: encode → download ── */
  async function fastEncode(
    recordCanvas: HTMLCanvasElement,
    renderer: (ctx: CanvasRenderingContext2D, t: number) => void,
    adId: number,
    audioBlob: Blob | null,
    filename: string,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    const blob = await fastEncodeToBlob(recordCanvas, renderer, adId, audioBlob, onProgress)
    triggerDownload(blob, filename)
  }

  /* ── Download MP4 — each ad is fully independent, multiple can encode in parallel ── */
  const downloadVideo = useCallback(async (ad: typeof ADS[0]) => {
    if (getAdDl(ad.id).phase === 'encoding') return
    const recordCanvas = recordRefs.current[ad.id]
    if (!recordCanvas) { alert('Canvas not ready — please refresh.'); return }

    patchAdDl(ad.id, { phase: 'encoding', pct: 0 })
    try {
      const blob = await fastEncodeToBlob(
        recordCanvas, RENDERERS[ad.id], ad.id,
        voices[ad.id]?.audioBlob ?? null,
        pct => patchAdDl(ad.id, { pct }),
      )
      triggerDownload(blob, ad.filename)
      patchAdDl(ad.id, { phase: 'done', pct: 100 })
      setTimeout(() => patchAdDl(ad.id, { phase: 'idle', pct: 0 }), 3000)
    } catch (e) {
      console.error('encode failed:', e)
      patchAdDl(ad.id, { phase: 'idle', pct: 0 })
    }
  }, [voices, adDls])

  /* ── Expert Voice Download — single API call per ad, one consistent voice ── */
  type ExpertAd = typeof ADS[0] & { expertScript?: string; expertVoiceDir?: string }
  const downloadWithExpertVoice = useCallback(async (ad: ExpertAd) => {
    if (getExpertAdDl(ad.id).phase !== 'idle') return
    if (!ad.expertScript) return
    const recordCanvas = recordRefs.current[ad.id]
    if (!recordCanvas) { alert('Canvas not ready — please refresh.'); return }

    patchExpertAdDl(ad.id, { phase: 'generating', pct: 10, error: null, label: 'Generating expert voice…' })
    let expertAudioBlob: Blob | null = null
    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mulberry',
          text: stripToneTags(ad.expertScript),
          description: ad.expertVoiceDir ?? 'confident warm Indian female voice, English only, natural energy',
          language: 'en',
        }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'API error' })); throw new Error(err.error ?? 'Failed') }
      expertAudioBlob = await res.blob()
    } catch (e: unknown) {
      patchExpertAdDl(ad.id, { phase: 'error', error: e instanceof Error ? e.message : 'Error', label: '' })
      return
    }

    patchExpertAdDl(ad.id, { phase: 'encoding', pct: 0, label: 'Encoding video…' })
    try {
      const blob = await fastEncodeToBlob(
        recordCanvas, RENDERERS[ad.id], ad.id,
        expertAudioBlob,
        pct => patchExpertAdDl(ad.id, { pct, label: `Encoding… ${pct}%` }),
      )
      triggerDownload(blob, `${ad.filename}-expert-voice`)
      patchExpertAdDl(ad.id, { phase: 'done', pct: 100, label: '' })
      setTimeout(() => patchExpertAdDl(ad.id, { phase: 'idle', pct: 0, label: '' }), 4000)
    } catch (e) {
      patchExpertAdDl(ad.id, { phase: 'error', error: e instanceof Error ? e.message : 'Encode failed', label: '' })
    }
  }, [expertAdDls])

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
              <p className="text-slate-500 text-xs mt-0.5">Canvas · 12Mbps · instant download · 30fps</p>
            </div>
          </div>
        </div>
        {/* Active encoding count badge */}
        {(() => {
          const enc = Object.values(adDls).filter(d => d.phase === 'encoding').length
            + Object.values(expertAdDls).filter(d => d.phase === 'encoding' || d.phase === 'generating').length
          return enc > 0 ? (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <Loader2 size={13} className="text-purple-400 animate-spin" />
              <span className="text-slate-300 text-sm">{enc} video{enc > 1 ? 's' : ''} encoding…</span>
            </div>
          ) : null
        })()}
      </div>

      {/* ── Ad cards ── */}
      <div className="px-8 py-6 space-y-6">
        {ADS.map(ad => {
          const v              = voices[ad.id]
          const isEx           = expanded === ad.id
          const adDl           = getAdDl(ad.id)
          const exAdDl         = getExpertAdDl(ad.id)
          const isEncoding     = adDl.phase === 'encoding'
          const isExpertActive = exAdDl.phase === 'generating' || exAdDl.phase === 'encoding'
          const hasExpert      = !!(ad as ExpertAd).expertScript

          return (
            <div key={ad.id} className={`rounded-2xl border overflow-hidden transition ${hasExpert ? 'border-pink-500/20 bg-pink-500/[0.015]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
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
                      <span className="text-white text-xs font-bold tabular-nums">{adDl.pct}%</span>
                    </div>
                  )}
                  {isExpertActive && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1.5">
                      <Loader2 size={20} className="text-pink-400 animate-spin" />
                      <span className="text-pink-300 text-[10px] font-bold text-center px-2">
                        {exAdDl.label || (exAdDl.phase === 'generating' ? 'Generating voice…' : `Encoding ${exAdDl.pct}%`)}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ad.tagColor}`}>{ad.tag}</span>
                  </div>
                  {hasExpert && (
                    <div className="absolute bottom-2 right-2 z-10">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/30 border border-pink-500/50 text-pink-300">✦ Expert</span>
                    </div>
                  )}
                </div>

                {/* Info + actions */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-white font-bold text-base">{ad.title}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">1080×1080 · 12Mbps · 30fps · canvas encode</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Download button — each ad independent, multiple can encode simultaneously */}
                      <button
                        onClick={() => downloadVideo(ad)}
                        disabled={isEncoding}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: ad.accent + '25', color: ad.accent, border: `1px solid ${ad.accent}50` }}
                      >
                        {isEncoding
                          ? <><Loader2 size={13} className="animate-spin" /> Encoding… {adDl.pct}%</>
                          : adDl.phase === 'done'
                          ? <><CheckCircle2 size={13} /> Downloaded!</>
                          : <><Download size={13} /> {v?.status === 'ready' ? 'Download with Voiceover' : 'Download MP4'}</>
                        }
                      </button>

                      {isEncoding && (
                        <div className="flex-1 min-w-[80px] bg-white/10 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${adDl.pct}%`, backgroundColor: ad.accent }} />
                        </div>
                      )}

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

                    {/* Expert Voice Download — per-line direction for new ads, single-call for legacy */}
                    {hasExpert && (
                      <>
                        <button
                          onClick={() => downloadWithExpertVoice(ad as ExpertAd)}
                          disabled={isExpertActive || exAdDl.phase === 'done'}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                          style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.15) 100%)', border: '1px solid rgba(236,72,153,0.35)', color: '#f9a8d4' }}
                        >
                          {exAdDl.phase === 'generating'
                            ? <><Loader2 size={13} className="animate-spin text-pink-400" /> {exAdDl.label || 'Generating…'}</>
                            : exAdDl.phase === 'encoding'
                            ? <><Loader2 size={13} className="animate-spin text-pink-400" /> {exAdDl.label || `Encoding… ${exAdDl.pct}%`}</>
                            : exAdDl.phase === 'done'
                            ? <><CheckCircle2 size={13} className="text-pink-400" /> Expert voice downloaded!</>
                            : <><Sparkles size={13} className="text-pink-400" /> Download Expert Voice MP4 · Female · English</>
                          }
                        </button>
                        {(exAdDl.phase === 'generating' || exAdDl.phase === 'encoding') && (
                          <div className="w-full bg-white/10 rounded-full h-1">
                            <div className="bg-pink-500 h-1 rounded-full transition-all duration-300" style={{ width: `${exAdDl.pct}%` }} />
                          </div>
                        )}
                        {exAdDl.phase === 'error' && (
                          <p className="text-red-400 text-xs px-1">{exAdDl.error}</p>
                        )}
                      </>
                    )}
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
                            disabled={isEncoding}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                          >
                            {isEncoding
                              ? <><Loader2 size={12} className="animate-spin" /> Encoding… {adDl.pct}%</>
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

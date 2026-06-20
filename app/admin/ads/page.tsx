'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, Play, Download, Mic, Loader2, Volume2, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Film, RefreshCw,
  Square, Clock,
} from 'lucide-react'

/* ─── Canvas dimensions ─────────────────────────────────────────── */
const W = 1080, H = 1080
const DUR = 30 // seconds

/* ─── Canvas helpers ────────────────────────────────────────────── */
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
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
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

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'))
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

/* ─── Ad 1: Cart Recovery ───────────────────────────────────────── */
function renderAd1(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, 0, W, H)
  grid(ctx)

  // blobs
  glow(ctx, 160, 200, 620, 'rgb(239,68,68)', 0.09 * cl(t / 1.5))
  glow(ctx, 920, 860, 520, 'rgb(37,211,102)', 0.07 * cl(t / 2))

  // S1: Problem 0-5s
  if (t < 5.5) {
    const f = t < .5 ? pr(t, 0, .5) : t > 4.5 ? 1 - pr(t, 4.5, 5.5) : 1

    // Badge
    const bp = pr(t, .1, .8)
    ctx.globalAlpha = f * bp
    rr(ctx, W / 2 - 210, 295, 420, 56, 28, 'rgba(239,68,68,.13)', 'rgba(239,68,68,.45)')
    ctx.beginPath(); ctx.arc(W / 2 - 155, 323, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'; ctx.fill()
    txt(ctx, 'HAPPENING RIGHT NOW', W / 2 + 20, 323, { size: 18, color: '#ef4444', weight: '800' })

    // 70%
    const np = pr(t, .3, 1.1)
    txt(ctx, '70%', W / 2, 500, { size: Math.round(200 * np), color: '#ef4444', weight: '900', alpha: f * np })

    // Label
    txt(ctx, 'of your carts are abandoned', W / 2, 620, { size: 34, color: '#94a3b8', weight: '400', alpha: f * pr(t, .9, 1.7) })

    // Stat cards
    const sp = pr(t, 2, 3)
    const cards = [{ v: '₹4.2L', l: 'Lost Monthly' }, { v: '84%', l: 'No Follow-up' }, { v: '₹0', l: 'Recovered' }]
    cards.forEach((c, i) => {
      const cx = 200 + i * 295
      ctx.globalAlpha = f * sp
      rr(ctx, cx, 690, 260, 120, 18, 'rgba(239,68,68,.07)', 'rgba(239,68,68,.22)')
      txt(ctx, c.v, cx + 130, 735, { size: 44, color: '#ef4444', weight: '900', alpha: f * sp })
      txt(ctx, c.l, cx + 130, 782, { size: 16, color: '#64748b', weight: '500', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  // S2: Brand 5-9s
  if (t >= 4.5 && t < 9.5) {
    const lt = t - 4.5, f = lt < .6 ? pr(lt, 0, .6) : lt > 4.5 ? 1 - pr(lt, 4.5, 5) : 1

    const lp = pr(lt, 0, .8)
    ctx.globalAlpha = f * lp
    ctx.beginPath(); ctx.arc(W / 2, 380, 70 * lp, 0, Math.PI * 2)
    ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, 380, { size: 52, alpha: f * pr(lt, .4, 1) })

    txt(ctx, 'Wapaci', W / 2, 498, { size: 86, weight: '900', alpha: f * pr(lt, .5, 1.3) })
    txt(ctx, 'WhatsApp Revenue Automation', W / 2, 590, { size: 28, color: '#64748b', weight: '400', alpha: f * pr(lt, 1, 2) })

    const pills = ['Cart Recovery', 'COD Confirm', 'Order Updates']
    const pp = pr(lt, 1.5, 2.5)
    pills.forEach((pill, i) => {
      const px = 160 + i * 295
      ctx.globalAlpha = f * pp
      rr(ctx, px, 660, 260, 50, 25, 'rgba(37,211,102,.1)', 'rgba(37,211,102,.35)')
      txt(ctx, pill, px + 130, 685, { size: 18, color: '#25D366', weight: '700', alpha: f * pp })
    })
    ctx.globalAlpha = 1
  }

  // S3: WA Chat 9-22s
  if (t >= 8.5 && t < 22.5) {
    const lt = t - 8.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 13.3 ? 1 - pr(lt, 13.3, 14) : 1
    ctx.globalAlpha = f

    // Phone
    const pw = 440, ph = 700, px = (W - pw) / 2, py = 170
    rr(ctx, px, py, pw, ph, 44, '#111827', 'rgba(255,255,255,.1)', 2)

    // Header
    rr(ctx, px, py, pw, 85, 44, '#075e54')
    ctx.fillStyle = '#075e54'; ctx.fillRect(px, py + 44, pw, 41)
    ctx.beginPath(); ctx.arc(px + 44, py + 44, 26, 0, Math.PI * 2)
    ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, 'W', px + 44, py + 44, { size: 22, weight: '900' })
    txt(ctx, 'Wapaci Recovery', px + 84, py + 36, { size: 20, weight: '700', align: 'left' })
    txt(ctx, 'online', px + 84, py + 60, { size: 15, color: 'rgba(255,255,255,.7)', weight: '400', align: 'left' })

    // Chat bg
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
      const mp = pr(lt, msg.t0, msg.t0 + .6)
      if (mp <= 0) return
      const isOut = msg.side === 'out'
      const bw = 350, lh = 26
      const bh = 24 + msg.lines.length * lh + 16
      const bx = isOut ? px + pw - bw - 14 : px + 14
      ctx.globalAlpha = f * mp
      rr(ctx, bx, my, bw, bh, 18, isOut ? '#005c4b' : '#1f2c34')
      msg.lines.forEach((line, li) => {
        txt(ctx, line, bx + 14, my + 32 + li * lh, { size: 18, weight: '400', align: 'left' })
      })
      my += bh + 10
    })
    ctx.globalAlpha = 1
  }

  // S4: Stats 22-28s
  if (t >= 22 && t < 28.5) {
    const lt = t - 22, f = lt < .7 ? pr(lt, 0, .7) : lt > 5.5 ? 1 - pr(lt, 5.5, 6.5) : 1
    txt(ctx, 'REAL RESULTS', W / 2, 310, { size: 26, color: '#475569', weight: '700', alpha: f * pr(lt, 0, .8) })
    const stats = [{ v: '28%', l: 'Recovery Rate', sub: 'vs 2% email' }, { v: '₹2.1L', l: 'Monthly Avg', sub: 'per brand' }, { v: '47×', l: 'ROI', sub: 'guaranteed' }]
    stats.forEach((s, i) => {
      const sp = pr(lt, .2 + i * .35, .9 + i * .35)
      ctx.globalAlpha = f * sp
      const cx = 150 + i * 300, cw = 270, ch = 210
      rr(ctx, cx, 370, cw, ch, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.2)')
      txt(ctx, s.v, cx + cw / 2, 450, { size: 66, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + cw / 2, 525, { size: 20, weight: '600', alpha: f * sp })
      txt(ctx, s.sub, cx + cw / 2, 556, { size: 16, color: '#64748b', weight: '400', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  // S5: CTA 28-30s
  if (t >= 27.5) {
    const lt = t - 27.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, 'rgb(37,211,102)', .15 * f)
    txt(ctx, 'Start Recovering', W / 2, 410, { size: 74, weight: '900', alpha: f })
    txt(ctx, 'Revenue Today', W / 2, 504, { size: 74, color: '#25D366', weight: '900', alpha: f })
    ctx.globalAlpha = f * pr(lt, .4, 1.1)
    rr(ctx, W / 2 - 210, 590, 420, 84, 42, '#25D366')
    txt(ctx, 'Try Wapaci Free →', W / 2, 632, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .4, 1.1) })
    txt(ctx, 'wapaci.com', W / 2, 726, { size: 24, color: '#64748b', weight: '400', alpha: f * pr(lt, .8, 1.5) })
    ctx.globalAlpha = 1
  }
}

/* ─── Ad 2: ROI Machine ─────────────────────────────────────────── */
function renderAd2(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#060d06'; ctx.fillRect(0, 0, W, H)
  grid(ctx, 'rgba(37,211,102,0.028)')
  glow(ctx, W / 2, H / 2, 700, 'rgb(37,211,102)', 0.07 * cl(t / 2))

  // S1: Counter 0-6s
  if (t < 6) {
    const f = t < .5 ? pr(t, 0, .5) : t > 5 ? 1 - pr(t, 5, 6) : 1
    txt(ctx, 'Revenue Recovered', W / 2, 340, { size: 32, color: '#475569', weight: '700', alpha: f * pr(t, 0, .8) })
    const maxVal = 210000
    const val = Math.round(maxVal * pr(t, .3, 4.5))
    txt(ctx, `₹${val.toLocaleString('en-IN')}`, W / 2, 490, { size: 96, color: '#25D366', weight: '900', alpha: f })
    txt(ctx, 'in 7 days • cart recovery', W / 2, 590, { size: 26, color: '#64748b', weight: '400', alpha: f * pr(t, 1, 2) })
    const p2 = pr(t, 2.5, 3.5)
    txt(ctx, '↑ from abandoned carts', W / 2, 660, { size: 22, color: '#22c55e', weight: '600', alpha: f * p2 })
    ctx.globalAlpha = 1
  }

  // S2: Brand 6-10s
  if (t >= 5.5 && t < 10.5) {
    const lt = t - 5.5, f = lt < .6 ? pr(lt, 0, .6) : lt > 4.5 ? 1 - pr(lt, 4.5, 5) : 1
    ctx.globalAlpha = f
    ctx.beginPath(); ctx.arc(W / 2, 380, 70 * pr(lt, 0, .8), 0, Math.PI * 2)
    ctx.fillStyle = '#25D366'; ctx.fill()
    txt(ctx, '💬', W / 2, 380, { size: 52, alpha: f * pr(lt, .3, 1) })
    txt(ctx, 'Wapaci', W / 2, 496, { size: 86, weight: '900', alpha: f * pr(lt, .5, 1.3) })
    txt(ctx, 'ROI Machine', W / 2, 590, { size: 36, color: '#25D366', weight: '700', alpha: f * pr(lt, .9, 1.8) })
    ctx.globalAlpha = 1
  }

  // S3: ROI Calculator 10-22s
  if (t >= 9.5 && t < 22.5) {
    const lt = t - 9.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 12.3 ? 1 - pr(lt, 12.3, 13) : 1
    txt(ctx, 'THE MATH IS SIMPLE', W / 2, 230, { size: 24, color: '#334155', weight: '800', alpha: f * pr(lt, 0, .8) })

    const rows = [
      { label: '₹5L abandoned carts/month', color: '#ef4444', p: pr(lt, .4, 1.3) },
      { label: '× 28% WhatsApp recovery rate', color: '#f59e0b', p: pr(lt, 1.6, 2.6) },
      { label: '= ₹1.4L recovered monthly', color: '#25D366', p: pr(lt, 3, 4.2) },
    ]
    rows.forEach((row, i) => {
      ctx.globalAlpha = f * row.p
      const ry = 310 + i * 130
      rr(ctx, 120, ry, W - 240, 100, 20, `${row.color}12`, `${row.color}35`)
      txt(ctx, row.label, W / 2, ry + 50, { size: 30, color: row.color, weight: '700', alpha: f * row.p })
    })

    // 47× ROI highlight
    const hp = pr(lt, 5, 6.5)
    ctx.globalAlpha = f * hp
    rr(ctx, 200, 720, 680, 160, 28, 'rgba(37,211,102,.12)', 'rgba(37,211,102,.4)', 2)
    txt(ctx, '47× ROI', W / 2, 778, { size: 72, color: '#25D366', weight: '900', alpha: f * hp })
    txt(ctx, 'on your marketing spend', W / 2, 845, { size: 22, color: '#64748b', weight: '400', alpha: f * hp })
    ctx.globalAlpha = 1
  }

  // S4: Stats 22-28s
  if (t >= 22 && t < 28.5) {
    const lt = t - 22, f = lt < .7 ? pr(lt, 0, .7) : lt > 5.5 ? 1 - pr(lt, 5.5, 6.5) : 1
    txt(ctx, 'WHY WHATSAPP WINS', W / 2, 300, { size: 26, color: '#334155', weight: '800', alpha: f * pr(lt, 0, .8) })
    const stats = [{ v: '98%', l: 'Open Rate' }, { v: '3 min', l: 'Avg Read Time' }, { v: '45%', l: 'Reply Rate' }]
    stats.forEach((s, i) => {
      const sp = pr(lt, .2 + i * .4, .9 + i * .4)
      ctx.globalAlpha = f * sp
      const cx = 130 + i * 300, cw = 270, cy = 360
      rr(ctx, cx, cy, cw, 240, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.22)')
      txt(ctx, s.v, cx + cw / 2, cy + 80, { size: 68, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + cw / 2, cy + 160, { size: 22, weight: '600', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  // S5: CTA 28-30s
  if (t >= 27.5) {
    const lt = t - 27.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, 'rgb(37,211,102)', .18 * f)
    txt(ctx, 'Your competitors are', W / 2, 380, { size: 52, weight: '700', alpha: f })
    txt(ctx, 'already doing this.', W / 2, 452, { size: 52, weight: '700', alpha: f })
    ctx.globalAlpha = f * pr(lt, .3, 1)
    rr(ctx, W / 2 - 220, 560, 440, 86, 43, '#25D366')
    txt(ctx, 'Start Free Trial →', W / 2, 603, { size: 28, color: '#000', weight: '800', alpha: f * pr(lt, .3, 1) })
    txt(ctx, 'wapaci.com', W / 2, 700, { size: 24, color: '#64748b', weight: '400', alpha: f * pr(lt, .7, 1.5) })
    ctx.globalAlpha = 1
  }
}

/* ─── Ad 3: Channel Wars ────────────────────────────────────────── */
function renderAd3(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H)
  grid(ctx)
  glow(ctx, 900, 200, 500, 'rgb(59,130,246)', 0.07 * cl(t / 2))
  glow(ctx, 200, 900, 500, 'rgb(37,211,102)', 0.06 * cl(t / 2))

  // S1: Question 0-6s
  if (t < 6) {
    const f = t < .6 ? pr(t, 0, .6) : t > 5 ? 1 - pr(t, 5, 6) : 1
    txt(ctx, 'Quick question.', W / 2, 390, { size: 58, weight: '800', alpha: f * pr(t, 0, .9) })
    txt(ctx, 'Which channel do your', W / 2, 480, { size: 46, color: '#94a3b8', weight: '400', alpha: f * pr(t, .5, 1.5) })
    txt(ctx, 'customers actually read?', W / 2, 548, { size: 46, color: '#94a3b8', weight: '400', alpha: f * pr(t, .8, 1.8) })
    ctx.globalAlpha = 1
  }

  // S2: Bar Chart Race 6-18s
  if (t >= 5.5 && t < 18.5) {
    const lt = t - 5.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 12.3 ? 1 - pr(lt, 12.3, 13) : 1

    const channels = [
      { label: 'Email', pct: 2,  color: '#3b82f6', tDelay: .3 },
      { label: 'SMS',   pct: 5,  color: '#f59e0b', tDelay: 1.8 },
      { label: 'WhatsApp', pct: 98, color: '#25D366', tDelay: 3.5 },
    ]

    const barMaxH = 420, barW = 200, gap = 100
    const baseY = 820
    const totalW = channels.length * barW + (channels.length - 1) * gap
    const startX = (W - totalW) / 2

    channels.forEach((ch, i) => {
      const cp = pr(lt, ch.tDelay, ch.tDelay + 2.5)
      const barH = barMaxH * (ch.pct / 100) * cp
      const bx = startX + i * (barW + gap)
      const by = baseY - barH

      ctx.globalAlpha = f * Math.min(1, cp * 2)

      // Bar
      rr(ctx, bx, by, barW, barH + 4, 12, ch.color + '30', ch.color + '80')

      // Glow for WhatsApp
      if (ch.pct === 98 && cp > .5) {
        const gg = ctx.createLinearGradient(bx, by, bx, by + barH)
        gg.addColorStop(0, ch.color + 'aa')
        gg.addColorStop(1, ch.color + '22')
        ctx.fillStyle = gg; ctx.fill()
      }

      // % label above bar
      const pct = Math.round(ch.pct * cp)
      txt(ctx, `${pct}%`, bx + barW / 2, by - 34, { size: ch.pct === 98 ? 52 : 38, color: ch.color, weight: '900', alpha: f * cp })

      // Channel label
      txt(ctx, ch.label, bx + barW / 2, baseY + 44, { size: 22, weight: '700', alpha: f * Math.min(1, cp * 2) })
    })

    // Open rate label
    const or2p = pr(lt, 6, 7.5)
    txt(ctx, 'Open Rate', W / 2, 240, { size: 26, color: '#334155', weight: '800', alpha: f * or2p })
    ctx.globalAlpha = 1
  }

  // S3: WhatsApp Stats 18-26s
  if (t >= 17.5 && t < 26.5) {
    const lt = t - 17.5, f = lt < .7 ? pr(lt, 0, .7) : lt > 8.3 ? 1 - pr(lt, 8.3, 9) : 1
    txt(ctx, 'Why WhatsApp wins', W / 2, 270, { size: 40, color: '#94a3b8', weight: '700', alpha: f * pr(lt, 0, .9) })

    const stats = [
      { icon: '📬', v: '98%', l: 'Open Rate', sub: 'vs 2% email' },
      { icon: '⚡', v: '3 min', l: 'Read Time', sub: 'avg response' },
      { icon: '💬', v: '45%', l: 'Reply Rate', sub: 'real engagement' },
    ]
    stats.forEach((s, i) => {
      const sp = pr(lt, .3 + i * .4, 1.1 + i * .4)
      ctx.globalAlpha = f * sp
      const cx = 130 + i * 300, cw = 265, cy = 340
      rr(ctx, cx, cy, cw, 270, 22, 'rgba(37,211,102,.07)', 'rgba(37,211,102,.2)')
      txt(ctx, s.icon, cx + cw / 2, cy + 55, { size: 44, alpha: f * sp })
      txt(ctx, s.v, cx + cw / 2, cy + 135, { size: 56, color: '#25D366', weight: '900', alpha: f * sp })
      txt(ctx, s.l, cx + cw / 2, cy + 195, { size: 20, weight: '700', alpha: f * sp })
      txt(ctx, s.sub, cx + cw / 2, cy + 226, { size: 15, color: '#64748b', weight: '400', alpha: f * sp })
    })
    ctx.globalAlpha = 1
  }

  // S4: CTA 26-30s
  if (t >= 25.5) {
    const lt = t - 25.5, f = lt < .7 ? pr(lt, 0, .7) : 1
    glow(ctx, W / 2, H / 2, 600, 'rgb(37,211,102)', .15 * f)
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

/* ─── Ad definitions ────────────────────────────────────────────── */
const ADS = [
  {
    id: 1, title: 'Cart Recovery — PAS Formula',
    tag: 'Cold Traffic', tagColor: 'bg-red-500/20 text-red-400 border-red-500/30',
    audience: 'Meta cold / lookalike', accent: '#ef4444',
    filename: 'wapaci-cart-recovery',
    // Muga script: tone tags + natural pauses for emotion and expressiveness
    script: `[serious] Right now...

[emotional] seventy percent of your customers... are leaving.

[serious] Without buying.

[conversational] That's real money. Walking out the door. Every. Single. Day.

[serious] And you have... absolutely no way to bring them back.

[emotional] Until now.

[excited] Wapaci sends them a WhatsApp message — automatically! In plain conversational Hindi or English. At exactly the right moment.

[conversational] And here's what happens?

[excited] Twenty-eight percent... come back!

[happy] Twenty-eight percent of your abandoned carts — recovered. Every single month. On autopilot.

[serious] Your competitors are already doing this.

[excited] Don't get left behind.

[happy] Try Wapaci free today — wapaci dot com!`,
    voiceDir: 'serious and urgent Indian male voice, slow and dramatic opening with long pauses, build suspense, then shift to excited and energetic when revealing the solution, warm and enthusiastic close, like a passionate brand founder sharing a breakthrough',
  },
  {
    id: 2, title: 'ROI Machine — Outcome First',
    tag: 'Warm Traffic', tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    audience: 'Retargeting / email list', accent: '#25D366',
    filename: 'wapaci-roi-machine',
    script: `[excited] What... if I told you...

[serious] Five lakh rupees of abandoned carts...

[excited] Could become... one point four lakh... in recovered revenue?

[serious] That's not a pitch. That's the math.

[conversational] WhatsApp messages get a...

[excited] ninety-eight percent open rate.

[serious] Nine. Eight. Percent.

[conversational] Read in under three minutes. Forty-five percent of customers... actually reply back.

[excited] That's forty-seven times your investment. Every. Single. Month.

[emotional] The math is simple. The setup? Ten minutes.

[serious] Your competitors are already using this.

[happy] The results speak for themselves.

[excited] Start your free trial at Wapaci dot com — today!`,
    voiceDir: 'confident Indian male voice, start with genuine curiosity and suspense, slow down dramatically on the numbers to let them land, conversational warmth in the middle, build back to high energy at the close, like a passionate entrepreneur sharing a discovery with a friend',
  },
  {
    id: 3, title: 'Channel Wars — Comparison',
    tag: 'Consideration', tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    audience: 'Brand aware / consideration', accent: '#3b82f6',
    filename: 'wapaci-channel-wars',
    script: `[serious] Quick question.

[conversational] Which channel... do your customers actually read?

[serious] Email?

[emotional] Two percent open rate. ...

[serious] SMS?

[emotional] Five percent. ...

[excited] WhatsApp?

[excited] Ninety. Eight. Percent!

[serious] Let that sink in for a second.

[conversational] Your customers are on WhatsApp. They read messages in under three minutes. And almost half of them... reply!

[emotional] Stop sending emails nobody opens.

[excited] Start sending WhatsApp messages that actually convert.

[happy] Wapaci — WhatsApp automation for Indian D2C brands.

[excited] Try it free today — wapaci dot com!`,
    voiceDir: 'Indian male voice, start slow and very deliberate like asking a rhetorical question to an audience, long silence between each channel stat, deliver each number with heavy weight and emphasis, peak with explosive excitement on WhatsApp stat, then thoughtful pause before the warm confident close',
  },
]

type VoiceoverState = {
  script: string
  status: 'idle' | 'generating' | 'ready' | 'error'
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
}

type RecState = {
  active: boolean
  adId: number | null
  secondsLeft: number
  done: boolean
}

export default function AdminAdsPage() {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [voiceovers, setVoiceovers] = useState<Record<number, VoiceoverState>>(
    Object.fromEntries(ADS.map(ad => [ad.id, {
      script: ad.script, status: 'idle', audioBlob: null, audioUrl: null, error: null,
    }]))
  )
  const [rec, setRec] = useState<RecState>({ active: false, adId: null, secondsLeft: 30, done: false })
  const recRef   = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef   = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})

  function setVo(id: number, patch: Partial<VoiceoverState>) {
    setVoiceovers(p => ({ ...p, [id]: { ...p[id], ...patch } }))
  }

  /* ── Generate voiceover ── */
  async function generate(ad: typeof ADS[0]) {
    const v = voiceovers[ad.id]
    if (v.audioUrl) URL.revokeObjectURL(v.audioUrl)
    setVo(ad.id, { status: 'generating', error: null, audioBlob: null, audioUrl: null })
    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'muga',
          text: v.script,
          // For Muga, description sets overall voice character on top of tone tags
          description: ad.voiceDir,
        }),
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

  /* ── Canvas + Web Audio recording — no screen share ── */
  const downloadVideo = useCallback(async (ad: typeof ADS[0]) => {
    const canvas = canvasRefs.current[ad.id]
    if (!canvas) return
    const v = voiceovers[ad.id]

    setRec({ active: true, adId: ad.id, secondsLeft: 30, done: false })
    chunksRef.current = []

    // Audio context
    const audioCtx = new AudioContext()
    const audioDest = audioCtx.createMediaStreamDestination()
    const master = audioCtx.createGain(); master.gain.value = 0.9
    master.connect(audioDest); master.connect(audioCtx.destination)

    // Decode + schedule voiceover
    if (v.audioBlob) {
      try {
        const buf = await audioCtx.decodeAudioData(await v.audioBlob.arrayBuffer())
        const src = audioCtx.createBufferSource(); src.buffer = buf
        const vg = audioCtx.createGain(); vg.gain.value = 1.15
        src.connect(vg); vg.connect(master)
        src.start(audioCtx.currentTime + 0.15)
      } catch (e) { console.warn('voiceover decode:', e) }
    }

    // Ambient pad (C major chord, very subtle)
    const freqs = [131, 165, 196, 262, 392]
    freqs.forEach(f => {
      const osc = audioCtx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f
      const g = audioCtx.createGain(); g.gain.setValueAtTime(0, audioCtx.currentTime)
      g.gain.linearRampToValueAtTime(0.022, audioCtx.currentTime + 2)
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + DUR - 2)
      osc.connect(g); g.connect(master); osc.start()
    })

    // Video stream from canvas
    const videoStream = canvas.captureStream(30)
    const audioStream = audioDest.stream
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()])

    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

    const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    recRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      audioCtx.close()
      if (timerRef.current) clearInterval(timerRef.current)
      const blob = new Blob(chunksRef.current, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${ad.filename}.${mime.includes('mp4') ? 'mp4' : 'webm'}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setRec({ active: false, adId: null, secondsLeft: 30, done: true })
      setTimeout(() => setRec(r => ({ ...r, done: false })), 4000)
    }

    recorder.start(100)

    // Countdown
    let secs = 30
    timerRef.current = setInterval(() => {
      secs--; setRec(r => ({ ...r, secondsLeft: secs }))
      if (secs <= 0) { clearInterval(timerRef.current!); recorder.stop() }
    }, 1000)

    // Canvas animation loop
    const startMs = performance.now()
    const renderer = RENDERERS[ad.id]
    const ctx2 = canvas.getContext('2d')!

    function frame() {
      const t = (performance.now() - startMs) / 1000
      renderer(ctx2, t)
      if (t < DUR) { rafRef.current = requestAnimationFrame(frame) }
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [voiceovers])

  function stopRec() {
    if (recRef.current?.state !== 'inactive') recRef.current?.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRec({ active: false, adId: null, secondsLeft: 30, done: false })
  }

  // Preview canvas (idle animation)
  useEffect(() => {
    const handles: Record<number, number> = {}
    ADS.forEach(ad => {
      const canvas = canvasRefs.current[ad.id]
      if (!canvas || rec.active) return
      const ctx = canvas.getContext('2d')!
      const start = performance.now()
      const loop = () => {
        const t = ((performance.now() - start) / 1000) % DUR
        RENDERERS[ad.id](ctx, t)
        handles[ad.id] = requestAnimationFrame(loop)
      }
      handles[ad.id] = requestAnimationFrame(loop)
    })
    return () => Object.values(handles).forEach(cancelAnimationFrame)
  }, [rec.active])

  useEffect(() => () => { stopRec() }, [])

  const recAd = ADS.find(a => a.id === rec.adId)

  return (
    <div className="min-h-screen bg-[#070b12] text-white">

      {/* ── Recording modal ── */}
      {rec.active && recAd && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-bold text-lg">Recording</span>
            <span className="text-slate-400 font-mono text-lg">{rec.secondsLeft}s</span>
            <button onClick={stopRec} className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold hover:bg-red-500/30 transition">
              <Square size={12} /> Stop
            </button>
          </div>
          <canvas
            ref={el => { canvasRefs.current[recAd.id] = el }}
            width={1080} height={1080}
            style={{ width: '540px', height: '540px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <p className="text-slate-500 text-sm">Canvas rendering directly — no screen share needed</p>
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
              <p className="text-slate-500 text-xs mt-0.5">Canvas rendering · no screen share · direct MP4</p>
            </div>
          </div>
        </div>
        {rec.done && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-semibold">Downloaded!</span>
          </div>
        )}
      </div>

      {/* ── Ad cards ── */}
      <div className="px-8 py-6 space-y-6">
        {ADS.map(ad => {
          const v = voiceovers[ad.id]
          const isExp = expanded === ad.id
          const isRec = rec.active && rec.adId === ad.id

          return (
            <div key={ad.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex gap-0">

                {/* Canvas preview */}
                <div className="relative flex-shrink-0 bg-black flex items-center justify-center" style={{ width: 200, height: 200 }}>
                  {!isRec && (
                    <canvas
                      ref={el => { canvasRefs.current[ad.id] = el }}
                      width={1080} height={1080}
                      style={{ width: 200, height: 200 }}
                    />
                  )}
                  {isRec && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400 text-xs font-bold">REC {rec.secondsLeft}s</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ad.tagColor}`}>{ad.tag}</span>
                  </div>
                </div>

                {/* Info + actions */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-white font-bold text-base">{ad.title}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{ad.audience}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Download — canvas-based, no screen share */}
                    <button
                      onClick={() => downloadVideo(ad)}
                      disabled={rec.active}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: ad.accent + '25', color: ad.accent, border: `1px solid ${ad.accent}50` }}
                    >
                      <Download size={13} />
                      {v.status === 'ready' ? 'Download with Voiceover' : 'Download MP4'}
                    </button>

                    {/* Voiceover toggle */}
                    <button
                      onClick={() => setExpanded(isExp ? null : ad.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                        v.status === 'ready'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic size={12} />
                      {v.status === 'ready' ? '✓ Voiceover Ready' : 'Add Voiceover'}
                      {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {v.status === 'ready' && (
                      <button
                        onClick={() => generate(ad)}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-500 hover:text-slate-300 text-sm transition"
                      >
                        <RefreshCw size={12} /> Regenerate
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Voiceover panel ── */}
              {isExp && (
                <div className="border-t border-white/[0.06] bg-black/20 p-5">
                  <div className="grid grid-cols-5 gap-5">

                    {/* Script */}
                    <div className="col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Script</label>
                        <button onClick={() => setVo(ad.id, { script: ad.script })} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition">
                          <RefreshCw size={9} /> Reset
                        </button>
                      </div>
                      <textarea
                        rows={11}
                        value={v.script}
                        onChange={e => setVo(ad.id, { script: e.target.value })}
                        className="w-full text-sm text-slate-200 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono leading-relaxed transition"
                      />
                      <p className="text-slate-600 text-[10px] mt-1.5 leading-relaxed">
                        Tone tags: <code className="text-purple-400">[serious]</code> <code className="text-purple-400">[excited]</code> <code className="text-purple-400">[emotional]</code> <code className="text-purple-400">[happy]</code> <code className="text-purple-400">[conversational]</code>
                        &nbsp;· Use <code className="text-purple-400">...</code> for dramatic pauses · Short sentences = natural rhythm
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="col-span-2 space-y-4">
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                        <p className="text-purple-300 text-xs font-semibold mb-1">Voice direction</p>
                        <p className="text-slate-500 text-[11px] leading-relaxed">{ad.voiceDir}</p>
                      </div>

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
                          <audio src={v.audioUrl} controls className="w-full" style={{ height: '32px' }} />
                          <button
                            onClick={() => downloadVideo(ad)}
                            disabled={rec.active}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                          >
                            <Download size={12} />
                            Download Video with Voiceover
                          </button>
                        </div>
                      )}

                      {v.status === 'ready' && (
                        <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                          <Clock size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-green-400 text-[11px] leading-relaxed">
                            Click <strong>Download with Voiceover</strong> — renders 30s animation directly, audio mixes automatically, file downloads. No screen share needed.
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

      {/* ── Footer note ── */}
      <div className="px-8 pb-10">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5 text-center">
          <p className="text-slate-600 text-xs">Canvas renders at 30fps · Audio via Web Audio API · No screen share required · Downloads as MP4 (Chrome) or WebM</p>
        </div>
      </div>
    </div>
  )
}

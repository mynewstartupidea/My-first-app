import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Reads the 5 standard UTM params off the current URL at submit time (not
// on mount) — client-only, call from inside a browser event handler. Meta's
// Ads Manager "URL Parameters" field is what actually appends these to the
// landing page link (e.g. utm_content={{ad.name}}), so this is how a lead
// submission knows which ad/campaign it came from.
export function getUtmParams(): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null; utm_content: string | null } {
  const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  return {
    utm_source:   p.get('utm_source'),
    utm_medium:   p.get('utm_medium'),
    utm_campaign: p.get('utm_campaign'),
    utm_term:     p.get('utm_term'),
    utm_content:  p.get('utm_content'),
  }
}

// Used to reject obviously-not-a-website input (a phone number, an email,
// random text) in the ecommerce landing page's optional "Your website"
// field before it ever reaches the server — people were typing their own
// phone/email into it, which then showed up meaninglessly in admin.
// Deliberately permissive about the actual URL shape (no scheme required,
// any TLD) since the bar here is just "looks like a domain," not full RFC
// validation — a real store URL should always clear this easily.
export function isValidWebsiteInput(raw: string): boolean {
  const v = raw.trim()
  if (!v) return true // optional field — empty is fine
  if (/@/.test(v)) return false // looks like an email
  if (/^[+\d\s()-]+$/.test(v)) return false // looks like a phone number
  return /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)
}

// Meta's pixel sets _fbp itself on every visit; _fbc only exists if the
// visitor arrived via an ad click (fbclid in the URL) — reading these at
// submit time is what lets the server-side Conversions API event match the
// same browsing session Meta already knows about, instead of relying on
// hashed email/phone alone for a much weaker match.
export function getFacebookCookies(): { fbp: string | null; fbc: string | null } {
  if (typeof document === 'undefined') return { fbp: null, fbc: null }
  const read = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] ?? null
  return { fbp: read('_fbp'), fbc: read('_fbc') }
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Conditional sections ({{#key}}...{{/key}}, included only when vars[key] is
// truthy) were being written into automation templates (e.g. a discount
// block in the abandoned-cart message) without ever being supported here —
// the old regex only matched \w+ (word characters), so "#discount" never
// matched at all and the raw {{#discount}}...{{/discount}} markup leaked
// straight into real WhatsApp messages. Sections are resolved first, then
// plain {{var}} substitution runs on what's left.
export function renderTemplate(template: string, vars: Record<string, string>) {
  const withSections = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => (
    vars[key] ? inner : ''
  ))
  return withSections.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// Extracts variable values from a template in the order they appear.
// Used to build positional params for WhatsApp approved template API calls.
// e.g. "Hi {{name}}, call {{phone}}" + {name:'John', phone:'9876'} → ['John', '9876']
export function extractTemplateParams(template: string, vars: Record<string, string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const [, key] of template.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(key)) { seen.add(key); result.push(vars[key] ?? '') }
  }
  return result
}

// Returns a 10-digit Indian mobile number or null
export function normalizeIndianPhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/^[''"`\s]+/, '').trim().replace(/[\s\-\.\(\)\/\\+]/g, '').replace(/\D/g, '')
  let ten: string | null = null
  if (digits.length === 10) ten = digits
  else if (digits.length === 12 && digits.startsWith('91')) ten = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) ten = digits.slice(1)
  else if (digits.length === 13 && digits.startsWith('091')) ten = digits.slice(3)
  return ten && /^[6-9]\d{9}$/.test(ten) ? ten : null
}

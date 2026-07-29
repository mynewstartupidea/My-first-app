import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
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

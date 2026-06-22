import type { Metadata } from 'next'
import EcomLanding from './EcomLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Cart Recovery for E-commerce — Wapaci',
  description: 'Stop losing ₹68 of every ₹100 in abandoned carts. Wapaci sends WhatsApp reminders with 98% open rate. Works with Shopify & WooCommerce.',
  robots: { index: false, follow: false },
}

export default function EcomPage() {
  return <EcomLanding />
}

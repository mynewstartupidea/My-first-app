import type { Metadata } from 'next'
import EcomLanding from './EcomLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Cart Recovery for Shopify Stores — Wapaci',
  description: 'Automatically recover abandoned carts, confirm COD orders, and send shipping updates on WhatsApp. Connects to Shopify in minutes. ₹1,999/month.',
  robots: { index: false, follow: false },
}

export default function EcomPage() {
  return <EcomLanding />
}

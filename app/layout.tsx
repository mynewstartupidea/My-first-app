import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UpsellAI – WhatsApp Revenue Recovery',
  description: 'Recover lost revenue and automate customer communication through WhatsApp for Shopify stores.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

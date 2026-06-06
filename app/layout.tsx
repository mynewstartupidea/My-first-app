import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wapaci – WhatsApp Revenue Automation for Shopify',
  description: 'Recover abandoned carts, verify COD orders, and automate customer communication on WhatsApp. Built for Indian D2C brands on Shopify.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wapaci – WhatsApp Automation for Ecommerce Brands',
  description: 'Recover abandoned carts, verify COD orders, and automate customer communication on WhatsApp. Built for ecommerce brands — works with Shopify, WooCommerce, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

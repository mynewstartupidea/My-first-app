import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'Wapaci – WhatsApp Automation for Ecommerce Brands',
  description: 'Recover abandoned carts, verify COD orders, and automate customer communication on WhatsApp. Built for ecommerce brands — works with Shopify, WooCommerce, and more.',
  metadataBase: new URL('https://wapaci.com'),
  icons: {
    icon:  [
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
    shortcut: '/icon',
  },
  openGraph: {
    title:       'Wapaci – WhatsApp Revenue Platform',
    description: 'Recover abandoned carts and automate WhatsApp messages for your ecommerce store.',
    url:         'https://wapaci.com',
    siteName:    'Wapaci',
    type:        'website',
    images: [{ url: '/logo.svg', width: 160, height: 40, alt: 'Wapaci Logo' }],
  },
  twitter: {
    card:        'summary',
    title:       'Wapaci – WhatsApp Automation for Ecommerce',
    description: 'Recover abandoned carts, verify COD, and automate WhatsApp messages.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

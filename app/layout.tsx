import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Self-hosted via next/font instead of the old @import from fonts.googleapis.com —
// that was a render-blocking external request on every page load (extra DNS/TLS
// round trip before the CSSOM could finish), worst on mobile networks. This inlines
// the font file at build time with no runtime fetch and no flash of fallback text.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title:       'Wapaci – WhatsApp Lead CRM',
  description: 'Automate WhatsApp follow-ups for Facebook Lead Ads. Log calls, schedule callbacks, and close more deals.',
  metadataBase: new URL('https://wapaci.com'),
  manifest: '/manifest.json',
  icons: {
    icon:  [{ url: '/icon', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    shortcut: '/icon',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wapaci',
  },
  openGraph: {
    title:       'Wapaci – WhatsApp Lead CRM',
    description: 'Automate WhatsApp follow-ups for Facebook Lead Ads.',
    url:         'https://wapaci.com',
    siteName:    'Wapaci',
    type:        'website',
  },
}

export const viewport: Viewport = {
  themeColor:  '#25D366',
  width:       'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import RealEstateLanding from './RealEstateLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Marketing for Real Estate Developers & Brokers — Wapaci',
  description: 'Never lose a hot lead again. Wapaci responds on WhatsApp in seconds, books site visits automatically, and nurtures cold leads until they\'re ready to buy.',
  robots: { index: false, follow: false },
}

export default function RealEstatePage() {
  return <RealEstateLanding />
}

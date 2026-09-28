import type { Metadata } from 'next'
import LeadsLanding from './LeadsLanding'

export const metadata: Metadata = {
  title: 'Never Lose a Lead Again — Wapaci',
  description: 'Reply to every lead on WhatsApp the moment they come in, track every follow-up in one place, and stop losing business to slow responses. ₹1,999/month.',
  robots: { index: false, follow: false },
}

export default function LeadsPage() {
  return <LeadsLanding />
}

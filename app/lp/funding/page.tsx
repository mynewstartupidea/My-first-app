import type { Metadata } from 'next'
import FundingLanding from './FundingLanding'

export const metadata: Metadata = {
  title: 'Raise Funding for Your Startup — Wapaci',
  description: 'Tell us about your startup and funding needs — our team will reach out to discuss next steps.',
  robots: { index: false, follow: false },
}

export default function FundingPage() {
  return <FundingLanding />
}

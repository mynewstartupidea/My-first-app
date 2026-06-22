import type { Metadata } from 'next'
import CoachingLanding from './CoachingLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Marketing for Coaching Institutes & Tutors — Wapaci',
  description: '100 enquiries, 8 enrollments. Wapaci follows up on WhatsApp in seconds so your leads never go cold — and your demo classes are always full.',
  robots: { index: false, follow: false },
}

export default function CoachingPage() {
  return <CoachingLanding />
}

import type { Metadata } from 'next'
import GymLanding from './GymLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Marketing for Gyms & Fitness Centres — Wapaci',
  description: 'Stop losing members silently. Wapaci sends renewal reminders, win-back campaigns, and class announcements on WhatsApp — automatically.',
  robots: { index: false, follow: false },
}

export default function GymPage() {
  return <GymLanding />
}

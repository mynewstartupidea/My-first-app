import type { Metadata } from 'next'
import RestaurantLanding from './RestaurantLanding'

export const metadata: Metadata = {
  title: 'WhatsApp Marketing for Restaurants & Cafes — Wapaci',
  description: 'Stop paying Zomato 30% commission to reach your own customers. Wapaci lets you broadcast daily specials, book tables, and build loyalty — on WhatsApp.',
  robots: { index: false, follow: false },
}

export default function RestaurantPage() {
  return <RestaurantLanding />
}

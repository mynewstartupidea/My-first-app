import Footer from '@/components/landing/footer'
import Navbar from '@/components/landing/navbar'
import Pricing from '@/components/landing/pricing'

export const metadata = {
  title: 'Pricing - Wapaci',
  description: 'Simple, transparent pricing for Wapaci WhatsApp automation — ₹1,999/month, cancel anytime.',
}

// Was its own hand-rolled 4-tier $USD grid billed through Shopify's billing
// API — same stale pricing model already replaced on the homepage (see
// components/landing/pricing.tsx's own comment). The navbar's "Pricing" nav
// link points here (a real route), not to the homepage's #pricing section,
// so fixing the homepage alone left this page still showing the old $
// figures — reusing the same component instead of maintaining a second,
// now-redundant copy of the identical lead-capture + Razorpay flow.
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Navbar />
      <Pricing />
      <Footer />
    </div>
  )
}

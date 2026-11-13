import Footer from '@/components/landing/footer'
import Navbar from '@/components/landing/navbar'
import Pricing from '@/components/landing/pricing'

export const metadata = {
  title: 'Get Started - Wapaci',
  description: 'Tell us about your business and our team will call you to set up WhatsApp automation for you.',
}

// No pricing shown anywhere on the marketing site anymore — this route kept
// its URL (ads/bookmarks may already point here) but now just reuses the
// same lead-capture-only component as the homepage's #pricing section.
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Navbar />
      <Pricing />
      <Footer />
    </div>
  )
}

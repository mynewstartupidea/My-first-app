import ScrollProgress from '@/components/landing/scroll-progress'
import Navbar from '@/components/landing/navbar'
import Hero from '@/components/landing/hero'
import Problem from '@/components/landing/problem'
import Features from '@/components/landing/features'
import HowItWorks from '@/components/landing/how-it-works'
import UseCases from '@/components/landing/use-cases'
import SocialProof from '@/components/landing/social-proof'
import Pricing from '@/components/landing/pricing'
import CtaSection from '@/components/landing/cta-section'
import FAQ from '@/components/landing/faq'
import Footer from '@/components/landing/footer'

export default function HomePage() {
  return (
    <main className="antialiased">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <UseCases />
      <SocialProof />
      <Pricing />
      <CtaSection />
      <FAQ />
      <Footer />
    </main>
  )
}

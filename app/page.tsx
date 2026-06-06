import Navbar from '@/components/landing/navbar'
import Hero from '@/components/landing/hero'
import Problem from '@/components/landing/problem'
import Features from '@/components/landing/features'
import HowItWorks from '@/components/landing/how-it-works'
import UseCases from '@/components/landing/use-cases'
import CtaSection from '@/components/landing/cta-section'
import FAQ from '@/components/landing/faq'
import Footer from '@/components/landing/footer'

export default function HomePage() {
  return (
    <main className="antialiased">
      <Navbar />
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <UseCases />
      <CtaSection />
      <FAQ />
      <Footer />
    </main>
  )
}

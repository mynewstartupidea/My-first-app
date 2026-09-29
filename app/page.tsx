import { redirect } from 'next/navigation'
import AuroraBg from '@/components/landing/aurora-bg'
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

interface Props {
  searchParams: Promise<{ code?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  // A PKCE auth link (password recovery, invite, magic link) is supposed to
  // land on /auth/callback?code=..., but Supabase falls back to the bare
  // Site URL whenever the specific redirectTo path isn't on the project's
  // allowed Redirect URLs list — which sends the code here, to the marketing
  // homepage, instead. This page has no auth logic at all, so that code was
  // silently dropped and the whole flow died: a password-reset link, for
  // example, just dumped the person on the landing page with no error,
  // and whatever they did next (e.g. clicking "Sign In") looked like the
  // link had done nothing. Forward it to /auth/callback, which already
  // knows how to exchange it for a session, instead of losing it.
  const { code } = await searchParams
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/dashboard`)

  return (
    <>
      <AuroraBg />
      <main className="antialiased relative" style={{ zIndex: 1 }}>
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
    </>
  )
}

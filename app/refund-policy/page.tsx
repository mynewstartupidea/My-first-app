import Link from 'next/link'

export const metadata = {
  title: 'Refund Policy - Wapaci',
  description: 'Refund policy for Wapaci subscription plans billed via Razorpay or the Shopify App Store.',
}

function NavBar() {
  return (
    <header className="bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img src="/logo-square.svg" alt="Wapaci" className="w-9 h-9 rounded-xl shadow-lg shadow-green-500/30 group-hover:scale-105 transition" />
          <span className="text-white font-bold text-xl tracking-tight">Wapaci</span>
        </Link>
        <Link href="/login" className="text-sm font-semibold bg-[#25D366] hover:bg-[#1db954] text-white px-4 py-2 rounded-xl transition shadow-lg shadow-green-500/20">
          Get started free
        </Link>
      </div>
    </header>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
      <div className="text-slate-400 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-20">
        <div className="mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Legal</span>
          <h1 className="mt-3 text-4xl font-extrabold text-white">Refund Policy</h1>
          <p className="mt-3 text-slate-500 text-sm">Last updated: October 2026</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            Wapaci subscription plans are billed monthly in advance, either via Razorpay (for accounts signed up directly through wapaci.com) or via Shopify App Pricing / the Shopify Billing API (for accounts installed through the Shopify App Store).
          </p>
        </div>

        <Section title="1. Subscription Charges">
          <p>Your subscription renews automatically each month until you cancel. Cancelling stops future renewals — it does not refund the current billing period, which you&apos;ve already had access to.</p>
          <p>You can cancel anytime from your account settings, or by contacting <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.</p>
        </Section>

        <Section title="2. Refunds">
          <p>We don&apos;t offer refunds or credits for partial billing periods, unused messages, or a decision to stop using Wapaci partway through a paid month.</p>
          <p>If you were charged in error — a duplicate charge, a charge after you&apos;d already cancelled, or a billing issue on our end — contact <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a> and we&apos;ll investigate and correct it.</p>
        </Section>

        <Section title="3. Third-Party Charges">
          <p>External services you connect, such as WhatsApp / Meta or your ecommerce platform, may have their own fees. Those charges are billed by those providers under their own terms and are not collected by Wapaci.</p>
        </Section>

        <Section title="4. Contact">
          <p>
            For questions about this policy or a specific charge, contact us at{' '}
            <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.
          </p>
        </Section>
      </main>

      <footer className="border-t border-white/5 mt-4 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/contact" className="hover:text-slate-400 transition">Contact</Link>
            <span>·</span>
            <Link href="/privacy-policy" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

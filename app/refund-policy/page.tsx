import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const metadata = {
  title: 'Refund Policy - Wapaci',
  description: 'Wapaci does not currently charge merchants a subscription fee.',
}

function NavBar() {
  return (
    <header className="bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-105 transition">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
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
          <p className="mt-3 text-slate-500 text-sm">Last updated: July 2026</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            Wapaci is currently free to use. We do not charge a Wapaci subscription fee or collect app payments outside Shopify.
          </p>
        </div>

        <Section title="1. Wapaci App Fees">
          <p>Because Wapaci currently has no paid app plan, there are no Wapaci subscription fees to refund.</p>
        </Section>

        <Section title="2. Third-Party Charges">
          <p>External services you connect, such as WhatsApp / Meta or your ecommerce platform, may have their own fees. Those charges are billed by those providers under their own terms and are not collected by Wapaci.</p>
        </Section>

        <Section title="3. Contact">
          <p>
            For questions about this policy, contact us at{' '}
            <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.
          </p>
        </Section>
      </main>
    </div>
  )
}

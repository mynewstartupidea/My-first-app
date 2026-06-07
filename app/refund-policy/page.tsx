import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const metadata = {
  title: 'Refund Policy – Wapaci',
  description: 'Wapaci refund and cancellation policy for subscription plans.',
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
        <Link
          href="/login"
          className="text-sm font-semibold bg-[#25D366] hover:bg-[#1db954] text-white px-4 py-2 rounded-xl transition shadow-lg shadow-green-500/20"
        >
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
          <p className="mt-3 text-slate-500 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            We want you to be satisfied with Wapaci. This policy outlines when refunds are available and how to request them. If you have any questions, contact us at{' '}
            <a href="mailto:billing@wapaci.com" className="text-[#25D366] hover:underline">billing@wapaci.com</a>.
          </p>
        </div>

        <Section title="1. Free Trial">
          <p>Wapaci offers a free trial period for new accounts. You will not be charged until your trial ends. You may cancel at any time during the trial at no cost.</p>
        </Section>

        <Section title="2. Subscription Cancellation">
          <p>You may cancel your Wapaci subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period. You will continue to have access to Wapaci until that date.</p>
          <p>We do not provide refunds for partial months of service if you cancel mid-cycle.</p>
        </Section>

        <Section title="3. Refunds for Subscription Fees">
          <p>We generally do not offer refunds for subscription platform fees once a billing period has started, except in the following circumstances:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong className="text-slate-300">Duplicate charge:</strong> If you were charged more than once for the same billing period.</li>
            <li><strong className="text-slate-300">Billing error:</strong> If you were charged an incorrect amount due to a technical error on our end.</li>
            <li><strong className="text-slate-300">Service unavailability:</strong> If Wapaci experienced prolonged downtime (&gt;72 consecutive hours) during a billing period, a pro-rated credit or refund may be issued at our discretion.</li>
          </ul>
        </Section>

        <Section title="4. Per-Message Charges">
          <p>Charges for WhatsApp messages sent through your BSP (Business Solution Provider) are governed by your BSP&apos;s billing terms. Wapaci does not control and cannot refund charges billed directly by your BSP.</p>
          <p>Where Wapaci bills per-message credits directly, unused credits are non-refundable but remain valid for the lifetime of your account.</p>
        </Section>

        <Section title="5. How to Request a Refund">
          <p>To request a refund, email us at <a href="mailto:billing@wapaci.com" className="text-[#25D366] hover:underline">billing@wapaci.com</a> with:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Your account email address</li>
            <li>The invoice number or charge date</li>
            <li>The reason for your refund request</li>
          </ul>
          <p>We will review your request and respond within 3–5 business days. Approved refunds are processed back to your original payment method within 7–10 business days.</p>
        </Section>

        <Section title="6. Chargebacks">
          <p>If you believe a charge is incorrect, please contact us before initiating a chargeback with your bank. Chargebacks can result in account suspension. We are happy to resolve billing issues directly and promptly.</p>
        </Section>

        <Section title="7. Contact">
          <p>
            For any billing or refund questions, contact our billing team at{' '}
            <a href="mailto:billing@wapaci.com" className="text-[#25D366] hover:underline">billing@wapaci.com</a>.
          </p>
        </Section>
      </main>

      <footer className="border-t border-white/5 mt-4 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/contact" className="hover:text-slate-400 transition">Contact</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
            <span>·</span>
            <Link href="/privacy-policy" className="hover:text-slate-400 transition">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

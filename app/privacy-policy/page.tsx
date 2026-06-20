import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy – Wapaci',
  description: 'How Wapaci collects, uses, and protects your data.',
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

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-20">
        <div className="mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Legal</span>
          <h1 className="mt-3 text-4xl font-extrabold text-white">Privacy Policy</h1>
          <p className="mt-3 text-slate-500 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            Wapaci (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This policy explains what data we collect, how we use it, and how we keep it safe when you use our WhatsApp automation platform.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <p><strong className="text-slate-300">Account data:</strong> When you create a Wapaci account, we collect your email address, name, and billing information.</p>
          <p><strong className="text-slate-300">Ecommerce store data:</strong> When you connect your store (Shopify, WooCommerce, etc.), we access order data, customer details, cart information, and product data needed to power automations. We only request the permissions necessary to run your configured automations.</p>
          <p><strong className="text-slate-300">Customer data:</strong> We process your customers&apos; names, phone numbers, and order details to send WhatsApp messages on your behalf. We act as a data processor for this information — you remain the data controller.</p>
          <p><strong className="text-slate-300">Message data:</strong> We store records of WhatsApp messages sent through our platform including delivery status, timestamps, and response data to power analytics and reporting.</p>
          <p><strong className="text-slate-300">Analytics data:</strong> We collect usage metrics such as message open rates, cart recovery rates, revenue attributed, and automation performance to provide your dashboard statistics.</p>
          <p><strong className="text-slate-300">Technical data:</strong> We collect standard server logs including IP addresses, browser type, and usage patterns to maintain security and improve our service.</p>
        </Section>

        <Section title="2. How We Use Your Data">
          <p>We use your data to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Deliver WhatsApp automation messages to your customers</li>
            <li>Sync customer and order information from your ecommerce platform</li>
            <li>Provide your analytics dashboard and performance reports</li>
            <li>Process payments and manage your subscription</li>
            <li>Send account notifications, invoices, and product updates</li>
            <li>Investigate and prevent fraud, abuse, or policy violations</li>
            <li>Improve and develop the Wapaci platform</li>
          </ul>
        </Section>

        <Section title="3. Third-Party Integrations">
          <p>Wapaci integrates with external services to deliver its functionality:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong className="text-slate-300">WhatsApp / Meta:</strong> Messages are sent via the WhatsApp Business API. Meta&apos;s data policies apply to message delivery.</li>
            <li><strong className="text-slate-300">WhatsApp / Meta Cloud API:</strong> Messages are sent directly via the WhatsApp Cloud API. Wapaci is an official Meta Business Partner — no third-party BSP is involved.</li>
            <li><strong className="text-slate-300">Ecommerce platforms (Shopify, WooCommerce):</strong> We connect to your store via official APIs using OAuth tokens.</li>
            <li><strong className="text-slate-300">Supabase:</strong> Our database and authentication infrastructure. Data is encrypted at rest.</li>
            <li><strong className="text-slate-300">Payment processors:</strong> We use industry-standard payment providers for billing. We do not store card details.</li>
          </ul>
        </Section>

        <Section title="4. Data Retention">
          <p>We retain your account data for as long as your account is active. If you close your account, we delete your data within 30 days, except where retention is required by law or for fraud prevention.</p>
          <p>Message logs and analytics data are retained for up to 12 months by default. You can request earlier deletion by contacting us.</p>
        </Section>

        <Section title="5. Data Security">
          <p>All data is encrypted in transit (TLS 1.2+) and at rest. We use industry-standard security practices and conduct regular security reviews. Access to customer data within our team is strictly limited to those who need it to operate the service.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your location, you may have rights including:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Access to your personal data</li>
            <li>Correction of inaccurate data</li>
            <li>Deletion of your data</li>
            <li>Data portability</li>
            <li>Objecting to certain processing</li>
          </ul>
          <p>To exercise your rights, email us at <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.</p>
        </Section>

        <Section title="7. Your Customers' Data">
          <p>You are responsible for obtaining consent from your customers to send them WhatsApp messages. Wapaci provides tools to respect opt-out requests — you must honour them. We will not send messages to customers who have opted out.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>We may update this policy from time to time. We will notify you of material changes by email or in-app notification. Continued use of Wapaci after a change constitutes acceptance of the new policy.</p>
        </Section>

        <Section title="9. Contact">
          <p>For privacy questions or data requests, contact us at <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.</p>
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
            <Link href="/refund-policy" className="hover:text-slate-400 transition">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

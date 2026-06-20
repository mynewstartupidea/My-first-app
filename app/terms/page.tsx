import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service – Wapaci',
  description: 'Terms of service for using the Wapaci WhatsApp automation platform.',
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-20">
        <div className="mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Legal</span>
          <h1 className="mt-3 text-4xl font-extrabold text-white">Terms of Service</h1>
          <p className="mt-3 text-slate-500 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Wapaci (&quot;Service&quot;). By creating an account or using Wapaci, you agree to these Terms. Please read them carefully.
          </p>
        </div>

        <Section title="1. Acceptable Use">
          <p>You agree to use Wapaci only for lawful purposes and in accordance with these Terms. You must not:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Send spam, unsolicited messages, or bulk messages to people who have not opted in</li>
            <li>Use Wapaci to harass, threaten, or deceive customers</li>
            <li>Send messages that violate WhatsApp&apos;s Business Policy or Meta&apos;s Platform Terms</li>
            <li>Use the Service to distribute malware, phishing links, or fraudulent content</li>
            <li>Attempt to reverse-engineer, scrape, or abuse the Wapaci platform or APIs</li>
            <li>Violate any applicable law, regulation, or third-party rights</li>
          </ul>
        </Section>

        <Section title="2. Account Responsibility">
          <p>You are responsible for maintaining the security of your Wapaci account credentials. You must not share your account with others. You are responsible for all activity that occurs under your account.</p>
          <p>If you suspect your account has been compromised, contact us immediately at <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.</p>
        </Section>

        <Section title="3. Subscription and Billing">
          <p>Wapaci is offered on a subscription basis. By subscribing, you authorise us to charge your payment method on a recurring basis (monthly or annually, depending on your plan).</p>
          <p>Prices are stated exclusive of applicable taxes. Taxes are added at checkout where required by law.</p>
          <p>We reserve the right to change our pricing. We will give you at least 30 days&apos; notice of any price changes via email before they take effect.</p>
          <p>For cancellation and refund terms, please refer to our <Link href="/refund-policy" className="text-[#25D366] hover:underline">Refund Policy</Link>.</p>
        </Section>

        <Section title="4. WhatsApp and Meta Compliance">
          <p>Wapaci operates as a platform that uses the WhatsApp Business API. Your use of WhatsApp messaging through Wapaci is subject to WhatsApp&apos;s Business Policy and Meta&apos;s Platform Terms in addition to these Terms.</p>
          <p>You are solely responsible for:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Obtaining valid opt-in consent from all customers before sending them WhatsApp messages</li>
            <li>Honouring opt-out requests promptly</li>
            <li>Ensuring message templates comply with WhatsApp&apos;s template approval requirements</li>
            <li>Not sending promotional messages to customers who have not consented to receive them</li>
          </ul>
          <p>Violations of WhatsApp&apos;s policies that result in account suspension or restrictions are not grounds for a refund.</p>
        </Section>

        <Section title="5. Ecommerce Integrations">
          <p>When you connect your ecommerce store (Shopify, WooCommerce, or other platforms) to Wapaci, you grant us permission to access the data necessary to run your automations (orders, customers, cart events). You represent that you have the right to grant this access.</p>
          <p>We access only the permissions required and do not store more data than necessary to operate the Service.</p>
        </Section>

        <Section title="6. No Abuse or Spam">
          <p>You must not use Wapaci to send spam or unsolicited commercial communications. We actively monitor for abuse and will suspend accounts that violate this policy without notice. Spam includes but is not limited to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Sending bulk messages to purchased phone number lists</li>
            <li>Re-messaging customers who have opted out</li>
            <li>Sending misleading or deceptive content</li>
            <li>Using Wapaci for non-ecommerce promotional campaigns without proper consent</li>
          </ul>
        </Section>

        <Section title="7. Service Availability">
          <p>We aim for 99.9% uptime but do not guarantee uninterrupted service. Planned maintenance, third-party outages (WhatsApp, ecommerce platforms), or unforeseen incidents may cause temporary unavailability.</p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>Wapaci and all content on the platform are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works without our express written consent.</p>
          <p>You retain all ownership of your own data (customer lists, message content, store data).</p>
        </Section>

        <Section title="9. Termination">
          <p>We reserve the right to suspend or terminate your account immediately if you breach these Terms, violate WhatsApp&apos;s policies, or engage in fraudulent activity. You may also terminate your account at any time by cancelling your subscription.</p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>To the maximum extent permitted by law, Wapaci is not liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including lost revenue, lost data, or business interruption.</p>
        </Section>

        <Section title="11. Changes to Terms">
          <p>We may update these Terms from time to time. We will notify you of material changes via email or in-app notification. Continued use of Wapaci after a change constitutes acceptance of the updated Terms.</p>
        </Section>

        <Section title="12. Contact">
          <p>For legal or compliance questions, contact us at <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>.</p>
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
            <Link href="/refund-policy" className="hover:text-slate-400 transition">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

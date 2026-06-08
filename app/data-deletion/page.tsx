import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export const metadata = {
  title: 'Data Deletion – Wapaci',
  description: 'How to request deletion of your data collected by Wapaci through Facebook / Meta.',
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

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-20">
        <div className="mb-12">
          <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">Legal</span>
          <h1 className="mt-3 text-4xl font-extrabold text-white">Data Deletion Instructions</h1>
          <p className="mt-3 text-slate-500 text-sm">Last updated: June 2025</p>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <p className="text-slate-300 text-sm leading-relaxed">
            Wapaci uses Facebook / Meta login and the WhatsApp Business API to let merchants connect their WhatsApp Business Account. This page explains what data we collect through Meta, what we do with it, and exactly how you can request its deletion.
          </p>
        </div>

        <Section title="1. Data We Collect via Meta">
          <p>When you connect your WhatsApp Business Account through Wapaci&apos;s Meta integration, we collect and store:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Your Facebook / Meta user ID and access token</li>
            <li>Your WhatsApp Business Account (WABA) ID</li>
            <li>Your WhatsApp phone number ID and display phone number</li>
            <li>Your Meta Business Manager ID</li>
            <li>Message delivery receipts (sent, delivered, read) from the WhatsApp Cloud API</li>
          </ul>
          <p>We do not store the content of messages after delivery. Message logs are retained for up to 12 months for analytics and then deleted.</p>
        </Section>

        <Section title="2. How to Request Data Deletion">
          <p>You can delete all data Wapaci holds about you — including data collected via Meta — using either of the following methods:</p>

          <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-slate-200 font-semibold text-sm mb-1">Option A — Delete from inside the app</p>
              <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-400 text-sm">
                <li>Log in to your Wapaci account at <a href="https://app.wapaci.com" className="text-[#25D366] hover:underline">app.wapaci.com</a></li>
                <li>Go to <strong className="text-slate-300">Settings → WhatsApp</strong></li>
                <li>Click <strong className="text-slate-300">Disconnect WhatsApp</strong> to remove your Meta / WABA credentials</li>
                <li>Go to <strong className="text-slate-300">Settings → Security → Danger Zone</strong></li>
                <li>Click <strong className="text-slate-300">Request account deletion</strong> and follow the instructions</li>
              </ol>
              <p className="mt-2 text-slate-500 text-xs">Your account and all associated data will be permanently deleted within <strong className="text-slate-400">30 days</strong>.</p>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-slate-200 font-semibold text-sm mb-1">Option B — Email us directly</p>
              <p>Send a deletion request to <a href="mailto:support@wapaci.com?subject=Data Deletion Request" className="text-[#25D366] hover:underline">support@wapaci.com</a> with the subject line <strong className="text-slate-300">"Data Deletion Request"</strong> and include:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 mt-2">
                <li>Your registered email address</li>
                <li>Your Wapaci store name or Facebook User ID (if known)</li>
              </ul>
              <p className="mt-2 text-slate-500 text-xs">We will confirm receipt within <strong className="text-slate-400">48 hours</strong> and complete deletion within <strong className="text-slate-400">30 days</strong>.</p>
            </div>
          </div>
        </Section>

        <Section title="3. What Gets Deleted">
          <p>Upon a verified deletion request, we permanently delete:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Your Wapaci account and login credentials</li>
            <li>Your Meta access token, WABA ID, and phone number ID</li>
            <li>Your connected Shopify store data and access tokens</li>
            <li>All customer records, message logs, and analytics data associated with your account</li>
            <li>Your billing history (financial records may be retained as required by law)</li>
            <li>All automation configurations and templates</li>
          </ul>
          <p>Data shared with Meta (e.g. messages sent via the WhatsApp Cloud API) is governed by <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">Meta&apos;s Privacy Policy</a>. You should also revoke Wapaci&apos;s access from your <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">Facebook App Settings</a>.</p>
        </Section>

        <Section title="4. Revoke App Access from Facebook">
          <p>To remove Wapaci&apos;s access to your Facebook / Meta account directly:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-2">
            <li>Go to your <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">Facebook Settings → Apps and Websites</a></li>
            <li>Find <strong className="text-slate-300">Wapaci</strong> in the list</li>
            <li>Click <strong className="text-slate-300">Remove</strong></li>
          </ol>
          <p>This revokes our access token. We will detect the revocation and automatically mark your WhatsApp integration as disconnected in Wapaci.</p>
        </Section>

        <Section title="5. Deletion Timeline">
          <p>We will complete all verified deletion requests within <strong className="text-slate-300">30 days</strong> of confirmation. We will send a confirmation email once deletion is complete.</p>
          <p>Some data may be retained longer where required by applicable law (e.g. billing records for tax compliance) or to prevent fraud.</p>
        </Section>

        <Section title="6. Contact">
          <p>For any questions about this policy or to submit a deletion request, contact us at:</p>
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 mt-2">
            <p className="text-slate-300 font-medium text-sm">Wapaci Support</p>
            <p className="text-slate-400 text-sm mt-1">
              Email: <a href="mailto:support@wapaci.com" className="text-[#25D366] hover:underline">support@wapaci.com</a>
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              Website: <a href="https://wapaci.com" className="text-[#25D366] hover:underline">wapaci.com</a>
            </p>
          </div>
        </Section>
      </main>

      <footer className="border-t border-white/5 mt-4 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Wapaci. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/privacy-policy" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
            <span>·</span>
            <Link href="/contact" className="hover:text-slate-400 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

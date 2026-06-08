'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/get-app-url'
import {
  MessageCircle, Loader2, AlertCircle, CheckCircle2,
  User, Building2, Phone, Users, Mail, Lock, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

const TEAM_SIZES = [
  { value: 'just_me',  label: 'Just me' },
  { value: '2_5',      label: '2–5 people' },
  { value: '6_20',     label: '6–20 people' },
  { value: '20_plus',  label: '20+ people' },
]

export default function SignupPage() {
  const [fullName, setFullName]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone]             = useState('')
  const [teamSize, setTeamSize]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teamSize) { setError('Please select your team size.'); return }
    setLoading(true)
    setError('')

    // 1. Create auth user with metadata
    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding`,
        data: {
          full_name:    fullName.trim(),
          company_name: companyName.trim(),
          phone:        phone.trim(),
          team_size:    teamSize,
        },
      },
    })

    if (authErr) { setError(authErr.message); setLoading(false); return }

    // 2. Save profile row (best-effort — may fail if email not confirmed yet in some configs)
    if (data.user) {
      await supabase.from('user_profiles').upsert({
        id:           data.user.id,
        full_name:    fullName.trim(),
        company_name: companyName.trim(),
        phone:        phone.trim(),
        team_size:    teamSize,
        email:        email.trim(),
      }, { onConflict: 'id' })
    }

    setLoading(false)

    // If Supabase auto-confirmed the account (email confirmation disabled),
    // go straight to onboarding. Otherwise show the "check your inbox" screen.
    if (data.session) {
      router.push('/onboarding')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-10">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Check your inbox!</h2>
            <p className="text-slate-500 text-sm mb-2">
              We sent a confirmation link to <span className="font-semibold text-slate-800">{email}</span>
            </p>
            <p className="text-slate-400 text-sm mb-8">
              Click the link in the email to confirm your account and you&apos;ll be taken straight to setup.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-[#25D366] font-medium hover:underline"
            >
              Back to sign in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-green-200 text-xs mt-5">Didn&apos;t get the email? Check spam or contact support@wapaci.com</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-xl mb-3 group-hover:scale-105 transition">
              <MessageCircle className="w-8 h-8 text-[#25D366]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Wapaci</h1>
          </Link>
          <p className="text-green-100 mt-1 text-sm">WhatsApp Automation for Ecommerce Brands</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
          <p className="text-slate-500 text-sm mb-6">Start recovering revenue with WhatsApp — free for 14 days</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Full name + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <User className="w-3 h-3 inline mr-1" />Your name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Mehta"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Building2 className="w-3 h-3 inline mr-1" />Company / Store
                </label>
                <input
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="KidsCraft India"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
            </div>

            {/* Row 2: Phone + Team size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Phone className="w-3 h-3 inline mr-1" />Phone number
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Users className="w-3 h-3 inline mr-1" />Team size
                </label>
                <select
                  value={teamSize}
                  onChange={e => setTeamSize(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                >
                  <option value="">Select…</option>
                  {TEAM_SIZES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                <Mail className="w-3 h-3 inline mr-1" />Work email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rahul@kidscraftindia.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                <Lock className="w-3 h-3 inline mr-1" />Password
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Creating account…' : 'Create free account'}
            </button>

            <p className="text-center text-xs text-slate-400">
              By signing up you agree to our{' '}
              <Link href="/terms" className="text-[#25D366] hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-[#25D366] hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-[#25D366] font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-green-200 text-xs mt-5">
          No credit card required · 14-day free trial · Cancel anytime
        </p>
      </div>
    </div>
  )
}

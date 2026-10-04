'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  MessageCircle, Loader2, AlertCircle,
  User, Building2, Phone, Users, Mail, Lock, ArrowRight,
  ShoppingCart, Target, Check,
} from 'lucide-react'
import Link from 'next/link'
import CustomSelect from '@/components/custom-select'

const TEAM_SIZES = [
  { value: 'just_me',  label: 'Just me' },
  { value: '2_5',      label: '2–5 people' },
  { value: '6_20',     label: '6–20 people' },
  { value: '20_plus',  label: '20+ people' },
]

// Asked once, here, instead of as its own onboarding step — it just picks
// which sensible sidebar defaults (lib/sidebar-sections.ts's
// DEFAULT_SECTIONS_BY_BUSINESS_TYPE) get applied automatically when the
// store is provisioned. Not a feature gate, and fully changeable later from
// Settings, so getting it "wrong" here costs nothing.
const BUSINESS_TYPES = [
  { value: 'ecommerce' as const, label: 'Ecommerce store', desc: 'I sell products online', icon: ShoppingCart },
  { value: 'lead_gen'  as const, label: 'Lead generation',  desc: 'I capture & follow up', icon: Target },
]

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0)  return { label: '',        color: 'bg-slate-200',  width: 'w-0'   }
  if (pw.length < 6)    return { label: 'Too short', color: 'bg-red-400',   width: 'w-1/4' }
  const hasUpper  = /[A-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const score = [pw.length >= 10, hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (score <= 1) return { label: 'Weak',   color: 'bg-orange-400', width: 'w-2/4' }
  if (score <= 2) return { label: 'Medium', color: 'bg-yellow-400', width: 'w-3/4' }
  return               { label: 'Strong',  color: 'bg-green-500',  width: 'w-full' }
}

export default function SignupPage() {
  const [fullName, setFullName]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone]             = useState('')
  const [teamSize, setTeamSize]       = useState('')
  const [businessType, setBusinessType] = useState<'ecommerce' | 'lead_gen' | ''>('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessType) { setError('Please select what best describes your business.'); return }
    if (!teamSize) { setError('Please select your team size.'); return }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Enter a valid phone number with at least 10 digits.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')

    // Created server-side (via the admin API, email_confirm: true) instead of
    // the client-side supabase.auth.signUp() this used to call — that path
    // depends on Supabase actually being able to send a confirmation email,
    // which isn't reliable here and shouldn't be able to block someone from
    // getting an account at all. No email step means no inbox-check screen:
    // sign them straight into the session this creates instead.
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        phone: phone.trim(),
        team_size: teamSize,
        business_type: businessType,
      }),
    })
    const body = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      setError(body.error ?? 'Something went wrong creating your account. Please try again.')
      setLoading(false)
      return
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInErr) {
      setError('Account created — please sign in.')
      setLoading(false)
      router.push('/login')
      return
    }

    await fetch('/api/auth/post-login', { method: 'POST' }).catch(() => {})
    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4 py-6 sm:py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-5 sm:mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-xl mb-2 sm:mb-3 group-hover:scale-105 transition">
              <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-[#25D366]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Wapaci</h1>
          </Link>
          <p className="text-green-100 mt-1 text-sm">Grow on WhatsApp.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
          <p className="text-slate-500 text-sm mb-6">Start recovering revenue with WhatsApp — free for 14 days</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Full name + Company — stacked below sm: at 2 columns on a
                narrow phone, each field had so little width left (page p-4 +
                card padding + gap, split in half) that placeholder text like
                "KidsCraft India" or "+91 98765 43210" visibly clipped
                mid-word instead of just being a bit snug. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <User className="w-3 h-3 inline mr-1" />Your name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Mehta"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
            </div>

            {/* What best describes your business — picks the sensible sidebar
                defaults for their account type automatically (fully
                changeable later from Settings), instead of asking as a
                separate step after signup. */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">What best describes your business?</label>
              <div className="grid grid-cols-2 gap-3">
                {BUSINESS_TYPES.map(bt => {
                  const Icon = bt.icon
                  const selected = businessType === bt.value
                  return (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => setBusinessType(bt.value)}
                      className={`relative h-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl border-2 transition ${
                        selected ? 'border-[#25D366] bg-[#25D366]/5' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-[#128C7E]' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-tight ${selected ? 'text-[#128C7E]' : 'text-slate-700'}`}>{bt.label}</p>
                        <p className="text-xs text-slate-400 leading-tight mt-0.5">{bt.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Row 2: Phone + Team size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Users className="w-3 h-3 inline mr-1" />Team size
                </label>
                <CustomSelect value={teamSize} onChange={setTeamSize} options={TEAM_SIZES} />
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
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
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
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
              {password.length > 0 && (() => {
                const s = passwordStrength(password)
                return (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${s.color} ${s.width}`} />
                    </div>
                    <p className={`text-xs font-medium ${
                      s.label === 'Strong' ? 'text-green-600'
                      : s.label === 'Medium' ? 'text-yellow-600'
                      : 'text-red-500'
                    }`}>{s.label}</p>
                  </div>
                )
              })()}
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
          No credit card required · Free account
        </p>
      </div>
    </div>
  )
}

// Admin-only: test any Meta access token step-by-step.
// Accepts token via query param or Authorization header.
// Returns full raw JSON from each Graph API call — no filtering.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'
const GRAPH       = 'https://graph.facebook.com/v21.0'

async function raw(url: string, token: string) {
  const sep     = url.includes('?') ? '&' : '?'
  const fullUrl = `${url}${sep}access_token=${token}`
  const start   = Date.now()
  try {
    const res  = await fetch(fullUrl)
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { json = text }
    return { url: url.split('?')[0], http: res.status, ok: res.ok, raw: text, parsed: json, ms: Date.now() - start }
  } catch (e) {
    return { url: url.split('?')[0], http: null, ok: false, raw: String(e), parsed: null, ms: Date.now() - start }
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? ''

  if (!token) {
    return NextResponse.json({
      error: 'Pass ?token=<access_token> — get a token from Meta Graph API Explorer or from Vercel function logs after an Embedded Signup attempt.',
    }, { status: 400 })
  }

  // ── 1. Token info ────────────────────────────────────────────────────────
  const meRes = await raw(`${GRAPH}/me?fields=id,name,email`, token)

  // ── 2. Permissions ───────────────────────────────────────────────────────
  const permRes = await raw(`${GRAPH}/me/permissions`, token)
  type PermEntry = { permission: string; status: string }
  const allPerms = (permRes.parsed as { data?: PermEntry[] } | null)?.data ?? []
  const granted  = allPerms.filter(p => p.status === 'granted').map(p => p.permission)
  const declined = allPerms.filter(p => p.status === 'declined').map(p => p.permission)

  const hasBizMgmt   = granted.includes('business_management')
  const hasWaBizMgmt = granted.includes('whatsapp_business_management')
  const hasWaMsg     = granted.includes('whatsapp_business_messaging')
  const missingScopes = [
    !hasBizMgmt   && 'business_management',
    !hasWaBizMgmt && 'whatsapp_business_management',
    !hasWaMsg     && 'whatsapp_business_messaging',
  ].filter(Boolean) as string[]

  // ── 3. Businesses ────────────────────────────────────────────────────────
  const bizRes = await raw(`${GRAPH}/me/businesses?fields=id,name,created_time`, token)
  type BizEntry = { id: string; name: string }
  const businesses = (bizRes.parsed as { data?: BizEntry[] } | null)?.data ?? []

  // ── 4. WABA per business ─────────────────────────────────────────────────
  const wabaResults: Record<string, unknown> = {}
  for (const biz of businesses.slice(0, 3)) {
    const r = await raw(
      `${GRAPH}/${biz.id}/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}`,
      token,
    )
    wabaResults[`${biz.id}(${biz.name})`] = r
  }

  // ── 5. Env config ────────────────────────────────────────────────────────
  const envConfig = {
    NEXT_PUBLIC_META_CONFIG_ID:  process.env.NEXT_PUBLIC_META_CONFIG_ID  ?? '(NOT SET)',
    NEXT_PUBLIC_META_APP_ID:     process.env.NEXT_PUBLIC_META_APP_ID     ?? '(NOT SET)',
    META_APP_ID:                 process.env.META_APP_ID                  ?? '(NOT SET)',
    META_SYSTEM_USER_ID_present: !!process.env.META_SYSTEM_USER_ID,
  }

  // ── Diagnosis ────────────────────────────────────────────────────────────
  let diagnosis = 'OK — all scopes present and businesses returned.'
  if (missingScopes.length > 0) {
    if (missingScopes.includes('business_management')) {
      diagnosis = `STALE OAUTH GRANT — business_management scope is missing. ` +
        `This almost always means the token was issued before this scope was added to the Embedded Signup config_id. ` +
        `Facebook caches authorizations per app; adding new scopes to config_id does NOT update existing grants. ` +
        `Fix: go to facebook.com → Settings → Business Integrations → Remove the Wapaci app → redo Embedded Signup. ` +
        `Also confirm NEXT_PUBLIC_META_CONFIG_ID in Vercel matches the config that lists all 3 scopes.`
    } else {
      diagnosis = `MISSING SCOPES: ${missingScopes.join(', ')}. Add them to your Embedded Signup config_id in Meta App Dashboard → WhatsApp → Embedded Signup, then revoke and re-authorize as above.`
    }
  } else if (businesses.length === 0) {
    diagnosis = 'All scopes present but /me/businesses returned empty. The Facebook account logged in during Embedded Signup is not an admin of any Business Portfolio. Check business.facebook.com with the same account.'
  }

  return NextResponse.json({
    diagnosis,
    config: envConfig,
    scopes: { granted, declined, missing: missingScopes, has_business_management: hasBizMgmt, has_whatsapp_business_management: hasWaBizMgmt, has_whatsapp_business_messaging: hasWaMsg },
    steps: {
      '1_me':          meRes,
      '2_permissions': permRes,
      '3_businesses':  bizRes,
      '4_waba':        wabaResults,
    },
  })
}

// Temporary admin-only endpoint — triggers the exact Graph API calls
// Meta App Review needs to register for whatsapp_business_management.
// Uses the OAuth user token stored from the Embedded Signup flow.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'
const GRAPH = 'https://graph.facebook.com/v21.0'

interface StepResult {
  step:        string
  url:         string
  status:      number | null
  ok:          boolean
  body:        unknown
  error?:      string
  durationMs:  number
}

async function callMeta(step: string, url: string, token: string): Promise<StepResult> {
  const start = Date.now()
  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}access_token=${token}`
  console.log(`[Meta Review Test] → ${step}: GET ${url.split('?')[0]}`)
  try {
    const res  = await fetch(fullUrl)
    const body = await res.json()
    const ms   = Date.now() - start
    console.log(`[Meta Review Test] ← ${step}: HTTP ${res.status} (${ms}ms)`, JSON.stringify(body).slice(0, 300))
    return { step, url: url.split('?')[0], status: res.status, ok: res.ok, body, durationMs: ms }
  } catch (e) {
    const ms = Date.now() - start
    console.error(`[Meta Review Test] ✗ ${step}: exception`, e)
    return { step, url: url.split('?')[0], status: null, ok: false, body: null, error: String(e), durationMs: ms }
  }
}

export async function GET() {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // ── Resolve token: prefer Embedded Signup user token stored in whatsapp_accounts
  // That is the token Meta App Review needs to see being exercised.
  // Fall back to META_ACCESS_TOKEN only if no Embedded Signup token exists.
  const { data: waRows } = await service
    .from('whatsapp_accounts')
    .select('access_token, waba_id, phone_number_id, display_phone_number, user_id, token_type')
    .order('updated_at', { ascending: false })
    .limit(5)

  const waWithToken = (waRows ?? []).find(r => r.access_token)
  const token       = waWithToken?.access_token ?? process.env.META_ACCESS_TOKEN ?? ''
  const tokenSource = waWithToken
    ? `whatsapp_accounts (user_id=${waWithToken.user_id}, token_type=${waWithToken.token_type})`
    : 'META_ACCESS_TOKEN env var (static — not from OAuth flow)'

  console.log(`[Meta Review Test] using token from: ${tokenSource}`)
  console.log(`[Meta Review Test] token present: ${!!token}, length: ${token.length}`)

  if (!token) {
    return NextResponse.json({
      error: 'No token available. Either complete an Embedded Signup flow first (so a token is stored in whatsapp_accounts), or set META_ACCESS_TOKEN in Vercel env vars.',
      token_source: tokenSource,
    }, { status: 400 })
  }

  const results: StepResult[] = []

  // ── Step 1: GET /me/permissions ─────────────────────────────────────────────
  const permStep = await callMeta(
    'GET /me/permissions',
    `${GRAPH}/me/permissions`,
    token,
  )
  results.push(permStep)

  // Extract granted scopes for the log
  type PermRow = { permission: string; status: string }
  const permBody = permStep.body as { data?: PermRow[] } | null
  const granted  = (permBody?.data ?? []).filter((p: PermRow) => p.status === 'granted').map((p: PermRow) => p.permission)
  console.log(`[Meta Review Test] granted scopes: ${granted.join(', ') || '(none returned)'}`)

  // ── Step 2: GET /me/businesses ──────────────────────────────────────────────
  const bizStep = await callMeta(
    'GET /me/businesses',
    `${GRAPH}/me/businesses?fields=id,name`,
    token,
  )
  results.push(bizStep)
  console.log(`[Meta Review Test] /me/businesses status: ${bizStep.status}`)

  type BizRow = { id: string; name: string }
  const bizBody     = bizStep.body as { data?: BizRow[] } | null
  const businesses  = bizBody?.data ?? []
  const firstBizId  = businesses[0]?.id ?? null

  // ── Step 3: GET /{business_id}/whatsapp_business_accounts ──────────────────
  let wabaStep: StepResult | null = null
  let firstWabaId: string | null  = null

  if (firstBizId) {
    wabaStep = await callMeta(
      `GET /${firstBizId}/whatsapp_business_accounts`,
      `${GRAPH}/${firstBizId}/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}`,
      token,
    )
    results.push(wabaStep)
    console.log(`[Meta Review Test] /${firstBizId}/whatsapp_business_accounts status: ${wabaStep.status}`)

    type WabaRow = { id: string; name: string }
    const wabaBody = wabaStep.body as { data?: WabaRow[] } | null
    firstWabaId    = wabaBody?.data?.[0]?.id ?? waWithToken?.waba_id ?? null
  } else {
    console.warn('[Meta Review Test] no business_id returned — skipping whatsapp_business_accounts call')
    // Still attempt with the stored waba_id if we have one
    firstWabaId = waWithToken?.waba_id ?? null
    results.push({
      step:       `GET /{business_id}/whatsapp_business_accounts`,
      url:        `${GRAPH}/(no business_id)`,
      status:     null,
      ok:         false,
      body:       null,
      error:      '/me/businesses returned no data — cannot determine business_id',
      durationMs: 0,
    })
  }

  // ── Step 4: GET /{waba_id}/phone_numbers ────────────────────────────────────
  if (firstWabaId) {
    const phoneStep = await callMeta(
      `GET /${firstWabaId}/phone_numbers`,
      `${GRAPH}/${firstWabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,platform_type`,
      token,
    )
    results.push(phoneStep)
    console.log(`[Meta Review Test] /${firstWabaId}/phone_numbers status: ${phoneStep.status}`)
  } else {
    console.warn('[Meta Review Test] no waba_id available — skipping phone_numbers call')
    results.push({
      step:       'GET /{waba_id}/phone_numbers',
      url:        `${GRAPH}/(no waba_id)`,
      status:     null,
      ok:         false,
      body:       null,
      error:      'No WABA ID found from /whatsapp_business_accounts or stored in DB',
      durationMs: 0,
    })
  }

  console.log(`[Meta Review Test] complete — ${results.filter(r => r.ok).length}/${results.length} calls succeeded`)

  return NextResponse.json({
    token_source:  tokenSource,
    granted_scopes: granted,
    has_wba_mgmt:  granted.includes('whatsapp_business_management'),
    has_wa_msg:    granted.includes('whatsapp_business_messaging'),
    results,
    summary: {
      total:    results.length,
      ok:       results.filter(r => r.ok).length,
      failed:   results.filter(r => !r.ok).length,
    },
  })
}

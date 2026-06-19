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
  const start   = Date.now()
  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}access_token=${token}`
  console.log(`[Meta Review Test] → ${step}: GET ${url.split('?')[0]}`)
  try {
    const res  = await fetch(fullUrl)
    const body = await res.json()
    const ms   = Date.now() - start
    console.log(`[Meta Review Test] ← ${step}: HTTP ${res.status} (${ms}ms)`, JSON.stringify(body).slice(0, 400))
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

  // ── Query whatsapp_accounts — capture error explicitly ────────────────────
  const { data: waRows, error: waError } = await service
    .from('whatsapp_accounts')
    .select('access_token, waba_id, phone_number_id, display_phone_number, user_id, token_type, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10)

  // Build a full debug picture before deciding what token to use
  const rowCount      = waRows?.length ?? 0
  const rowsWithToken = (waRows ?? []).filter(r => r.access_token)
  const latestRow     = waRows?.[0] ?? null
  const waWithToken   = rowsWithToken[0] ?? null

  // Determine exact fallback reason
  let fallbackReason: string | null = null
  if (waError) {
    fallbackReason = `whatsapp_accounts query failed: ${waError.message} (code: ${waError.code})`
  } else if (rowCount === 0) {
    fallbackReason = 'whatsapp_accounts table is empty — no Embedded Signup has been completed yet'
  } else if (rowsWithToken.length === 0) {
    fallbackReason = `Found ${rowCount} row(s) in whatsapp_accounts but access_token is null on all of them`
  }

  const token       = waWithToken?.access_token ?? process.env.META_ACCESS_TOKEN ?? ''
  const tokenSource = waWithToken
    ? `whatsapp_accounts (user_id=${waWithToken.user_id}, token_type=${waWithToken.token_type})`
    : fallbackReason
      ? `META_ACCESS_TOKEN env var — FALLBACK REASON: ${fallbackReason}`
      : 'META_ACCESS_TOKEN env var (static)'

  console.log(`[Meta Review Test] whatsapp_accounts: rowCount=${rowCount} error=${waError?.message ?? 'none'} rowsWithToken=${rowsWithToken.length}`)
  console.log(`[Meta Review Test] token source: ${tokenSource}`)
  console.log(`[Meta Review Test] token present: ${!!token}, length: ${token.length}`)
  if (fallbackReason) console.warn(`[Meta Review Test] fallback reason: ${fallbackReason}`)

  // Debug block returned in every response
  const debug = {
    whatsapp_accounts: {
      query_error:       waError ? { message: waError.message, code: waError.code } : null,
      row_count:         rowCount,
      rows_with_token:   rowsWithToken.length,
      fallback_reason:   fallbackReason,
      latest_row: latestRow ? {
        user_id:            latestRow.user_id,
        status:             latestRow.status,
        token_type:         latestRow.token_type,
        has_access_token:   !!latestRow.access_token,
        has_waba_id:        !!latestRow.waba_id,
        has_phone_number_id: !!latestRow.phone_number_id,
        has_business_id:    false, // business_id is not stored in whatsapp_accounts (only waba_id)
        display_phone:      latestRow.display_phone_number ?? null,
        updated_at:         latestRow.updated_at ?? null,
      } : null,
      all_rows_summary: (waRows ?? []).map(r => ({
        user_id:          r.user_id,
        status:           r.status,
        has_access_token: !!r.access_token,
        has_waba_id:      !!r.waba_id,
        updated_at:       r.updated_at,
      })),
    },
    env_vars: {
      META_ACCESS_TOKEN_present:    !!process.env.META_ACCESS_TOKEN,
      META_ACCESS_TOKEN_length:     process.env.META_ACCESS_TOKEN?.length ?? 0,
      META_SYSTEM_USER_ID_present:  !!process.env.META_SYSTEM_USER_ID,
      META_APP_ID_present:          !!process.env.META_APP_ID,
    },
  }

  if (!token) {
    return NextResponse.json({
      error:        'No token available — whatsapp_accounts is empty AND META_ACCESS_TOKEN env var is not set.',
      token_source: tokenSource,
      debug,
    }, { status: 400 })
  }

  const results: StepResult[] = []

  // ── Step 1: GET /me/permissions ─────────────────────────────────────────────
  const permStep = await callMeta('GET /me/permissions', `${GRAPH}/me/permissions`, token)
  results.push(permStep)

  type PermRow = { permission: string; status: string }
  const permBody = permStep.body as { data?: PermRow[] } | null
  const granted  = (permBody?.data ?? []).filter((p: PermRow) => p.status === 'granted').map((p: PermRow) => p.permission)
  console.log(`[Meta Review Test] granted scopes: ${granted.join(', ') || '(none returned)'}`)

  // ── Step 2: GET /me/businesses ──────────────────────────────────────────────
  const bizStep = await callMeta('GET /me/businesses', `${GRAPH}/me/businesses?fields=id,name`, token)
  results.push(bizStep)
  console.log(`[Meta Review Test] /me/businesses status: ${bizStep.status}`)

  type BizRow = { id: string; name: string }
  const bizBody    = bizStep.body as { data?: BizRow[] } | null
  const firstBizId = bizBody?.data?.[0]?.id ?? null

  // ── Step 3: GET /{business_id}/whatsapp_business_accounts ──────────────────
  let firstWabaId: string | null = null

  if (firstBizId) {
    const wabaStep = await callMeta(
      `GET /${firstBizId}/whatsapp_business_accounts`,
      `${GRAPH}/${firstBizId}/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}`,
      token,
    )
    results.push(wabaStep)
    console.log(`[Meta Review Test] /${firstBizId}/whatsapp_business_accounts status: ${wabaStep.status}`)

    type WabaRow = { id: string }
    const wabaBody = wabaStep.body as { data?: WabaRow[] } | null
    firstWabaId    = wabaBody?.data?.[0]?.id ?? waWithToken?.waba_id ?? null
  } else {
    // No business_id from /me/businesses — try stored waba_id directly
    firstWabaId = waWithToken?.waba_id ?? null
    results.push({
      step:       'GET /{business_id}/whatsapp_business_accounts',
      url:        `${GRAPH}/(skipped — no business_id)`,
      status:     null,
      ok:         false,
      body:       null,
      error:      `/me/businesses returned no data. This usually means the token lacks 'business_management' scope or the account has no Business Portfolio.`,
      durationMs: 0,
    })
    console.warn('[Meta Review Test] /me/businesses returned no business_id — skipping WABA call')
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
    results.push({
      step:       'GET /{waba_id}/phone_numbers',
      url:        `${GRAPH}/(skipped — no waba_id)`,
      status:     null,
      ok:         false,
      body:       null,
      error:      'No WABA ID available from /whatsapp_business_accounts or whatsapp_accounts table.',
      durationMs: 0,
    })
    console.warn('[Meta Review Test] no waba_id — skipping phone_numbers call')
  }

  console.log(`[Meta Review Test] complete — ${results.filter(r => r.ok).length}/${results.length} succeeded`)

  return NextResponse.json({
    token_source:   tokenSource,
    fallback_reason: fallbackReason,
    granted_scopes: granted,
    has_wba_mgmt:   granted.includes('whatsapp_business_management'),
    has_wa_msg:     granted.includes('whatsapp_business_messaging'),
    debug,
    results,
    summary: {
      total:  results.length,
      ok:     results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
    },
  })
}

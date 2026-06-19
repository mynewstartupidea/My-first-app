// Meta WhatsApp Embedded Signup — callback handler
// POST: called by client after FB JS SDK popup returns a code (no redirect_uri needed)
// GET:  called by Meta redirect-based OAuth (redirect_uri must match)

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignSystemUserToWABA, exchangeMetaCode, subscribeWABAWebhooks } from '@/lib/whatsapp'
import type { MetaDebugInfo, MetaSessionInfo } from '@/lib/whatsapp'

// ─── Shared processing ────────────────────────────────────────────────────────

type ProcessResult =
  | { ok: true;  phone: string; debug: MetaDebugInfo }
  | { ok: false; error: string; debug?: MetaDebugInfo }

async function processMetaCode(
  code: string,
  redirectUri: string | undefined,
  userId: string,
  sessionInfo?: MetaSessionInfo,
): Promise<ProcessResult> {
  console.log(`[Meta callback] processing code, redirectUri=${redirectUri ?? 'none (SDK flow)'}, sessionInfo=${sessionInfo?.wabaID ? `wabaID=${sessionInfo.wabaID}` : 'absent'}`)

  const result = await exchangeMetaCode(code, redirectUri, sessionInfo)

  if (!result.ok) {
    console.error(`[Meta callback] exchangeMetaCode failed at step="${result.step}": ${result.error}`)
    console.error('[Meta callback] debug:', JSON.stringify(result.debug ?? {}))
    return { ok: false, error: result.error, debug: result.debug }
  }

  const { info } = result
  console.log(`[Meta callback] exchange OK — wabaId=${info.wabaId} phone=${info.displayPhoneNumber} biz=${info.businessId}`)

  const systemUserToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN
  const [assignedSystemUser, webhooksSubscribed] = await Promise.all([
    assignSystemUserToWABA(info.wabaId, info.accessToken),
    subscribeWABAWebhooks(info.wabaId, systemUserToken ?? info.accessToken),
  ])

  console.log(`[Meta callback] systemUser=${assignedSystemUser} webhooks=${webhooksSubscribed}`)

  const tokenType: 'user_token' | 'system_user_token' =
    systemUserToken && assignedSystemUser ? 'system_user_token' : 'user_token'

  const service    = createServiceClient()
  const authClient = await createClient()

  const { data: storeRows } = await authClient
    .from('stores')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false })
    .limit(1)
  const store = storeRows?.[0] ?? null

  const { error: upsertErr } = await service.from('whatsapp_accounts').upsert({
    user_id:              userId,
    store_id:             store?.id ?? null,
    business_id:          info.businessId,
    waba_id:              info.wabaId,
    phone_number_id:      info.phoneNumberId,
    display_phone_number: info.displayPhoneNumber,
    access_token:         info.accessToken,
    token_type:           tokenType,
    status:               'connected',
    provider:             'meta',
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (upsertErr) {
    console.error('[Meta callback] DB upsert failed:', upsertErr.message)
    return { ok: false, error: `Database error: ${upsertErr.message}` }
  }

  if (store) {
    await service.from('stores').update({
      whatsapp_number:  info.displayPhoneNumber,
      whatsapp_bsp:     'meta',
      whatsapp_api_key: info.accessToken,
      updated_at:       new Date().toISOString(),
    }).eq('id', store.id)
  }

  console.log(`[Meta callback] done — token_type=${tokenType} storeUpdated=${!!store}`)
  return { ok: true, phone: info.displayPhoneNumber, debug: result.debug }
}

// ─── POST — FB JS SDK Embedded Signup flow ────────────────────────────────────
// Client POSTs { code } after FB.login() completes. No redirect_uri needed.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    code?:                string
    sessionInfo?:         MetaSessionInfo
    rawAuthResponseKeys?: string[]
    rawAuthResponse?:     Record<string, unknown>
  }
  if (!body.code) return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })

  // Log the full raw authResponse from the client so we can see exactly what Meta returned
  console.log('[Meta callback] rawAuthResponseKeys:', JSON.stringify(body.rawAuthResponseKeys ?? []))
  console.log('[Meta callback] rawAuthResponse:', JSON.stringify(body.rawAuthResponse ?? {}))
  console.log('[Meta callback] sessionInfo received:', JSON.stringify(body.sessionInfo ?? null))

  const result = await processMetaCode(body.code, undefined, user.id, body.sessionInfo)
  return NextResponse.json(result)
}

// ─── GET — redirect-based OAuth fallback ─────────────────────────────────────
// Meta redirects here with ?code= after standard OAuth dialog.
// Passes redirect_uri so the token exchange can validate it.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const desc = searchParams.get('error_description') ?? 'Meta authorization failed'
    console.error('[Meta callback GET] Meta returned error:', desc)
    return NextResponse.redirect(`${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent(desc)}`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const redirectUri = `${origin}/api/meta/callback`
  const result      = await processMetaCode(code, redirectUri, user.id)

  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent(result.error)}`
    )
  }

  return NextResponse.redirect(`${origin}/dashboard/settings?tab=whatsapp&connected=meta`)
}

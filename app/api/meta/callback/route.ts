// Meta WhatsApp Embedded Signup — callback handler
// POST: called by client after FB JS SDK popup returns a code (no redirect_uri needed)
// GET:  called by Meta redirect-based OAuth (redirect_uri must match)

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignSystemUserToWABA, exchangeMetaCode, registerPhoneNumber, subscribeWABAWebhooks } from '@/lib/whatsapp'
import { provisionStarterTemplates } from '@/lib/whatsapp-templates'
import type { MetaDebugInfo, MetaSessionInfo } from '@/lib/whatsapp'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// ─── Shared processing ────────────────────────────────────────────────────────

type ProcessResult =
  | { ok: true;  phone: string; debug: MetaDebugInfo }
  | { ok: false; error: string; debug?: MetaDebugInfo; rawAuthResponseKeys?: string[]; rawAuthResponse?: Record<string, unknown> }

async function processMetaCode(
  code: string,
  redirectUri: string | undefined,
  userId: string,
  sessionInfo?: MetaSessionInfo,
  rawAuthResponseKeys?: string[],
  rawAuthResponse?: Record<string, unknown>,
  connectionMode: 'cloud_api' | 'coexistence' = 'cloud_api',
): Promise<ProcessResult> {
  console.log(`[Meta callback] processing code, redirectUri=${redirectUri ?? 'none (SDK flow)'}, sessionInfo=${sessionInfo?.wabaID ? `wabaID=${sessionInfo.wabaID}` : 'absent'}`)

  const result = await exchangeMetaCode(code, redirectUri, sessionInfo)

  if (!result.ok) {
    console.error(`[Meta callback] exchangeMetaCode failed at step="${result.step}": ${result.error}`)
    console.error('[Meta callback] debug:', JSON.stringify(result.debug ?? {}))
    return {
      ok:    false,
      error: result.error,
      debug: result.debug,
      rawAuthResponseKeys,
      rawAuthResponse,
    }
  }

  const { info } = result
  console.log(`[Meta callback] exchange OK — wabaId=${info.wabaId} phone=${info.displayPhoneNumber} biz=${info.businessId}`)

  const systemUserToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN
  const [assignedSystemUser, webhooksSubscribed, phoneRegistered] = await Promise.all([
    assignSystemUserToWABA(info.wabaId, info.accessToken),
    subscribeWABAWebhooks(info.wabaId, systemUserToken ?? info.accessToken),
    // Without this, the number stays at Meta's `status: PENDING` forever —
    // Embedded Signup's in-popup flow only verifies phone OWNERSHIP, not
    // messaging readiness. Every send (test message, automation, campaign)
    // against a PENDING number fails with "Account not registered"
    // (code 133010) regardless of anything else being correctly connected.
    registerPhoneNumber(info.phoneNumberId, info.accessToken),
  ])

  console.log(`[Meta callback] systemUser=${assignedSystemUser} webhooks=${webhooksSubscribed} phoneRegistered=${phoneRegistered}`)

  if (!phoneRegistered) {
    console.error(`[Meta callback] CRITICAL: phone registration failed for phoneNumberId=${info.phoneNumberId} — this number cannot send or receive messages until registered.`)
  }

  const tokenType: 'user_token' | 'system_user_token' =
    systemUserToken && assignedSystemUser ? 'system_user_token' : 'user_token'

  if (tokenType === 'user_token') {
    // This means one of: META_SYSTEM_USER_ACCESS_TOKEN not set, or assignSystemUserToWABA failed.
    // The merchant's token will expire in 60 days. Set the two META_SYSTEM_USER_* env vars to fix this.
    console.warn(`[Meta callback] WARNING: storing 60-day user token for user=${userId}. Set META_SYSTEM_USER_ID + META_SYSTEM_USER_ACCESS_TOKEN in Vercel to use permanent tokens.`)
  }

  const service = createServiceClient()

  // Service client, not the caller's session client — `userId` here is the
  // resolved ORG OWNER's id (see processMetaCode's callers below), which for
  // an admin teammate completing this flow differs from their own auth.uid().
  // stores' RLS is USING (auth.uid() = user_id), so a session-scoped query
  // for the owner's store would silently return zero rows for anyone but the
  // owner themselves, leaving store_id null on the new whatsapp_accounts row
  // and skipping the stores.whatsapp_number/bsp/api_key update below even
  // though the WABA connection itself succeeded.
  const { data: storeRows } = await service
    .from('stores')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false })
    .limit(1)
  const store = storeRows?.[0] ?? null

  // Delete any existing row first — avoids needing a unique constraint on user_id
  await service.from('whatsapp_accounts').delete().eq('user_id', userId)

  const { error: insertErr } = await service.from('whatsapp_accounts').insert({
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
    connection_mode:      connectionMode,
    updated_at:           new Date().toISOString(),
  })

  if (insertErr) {
    console.error('[Meta callback] DB insert failed:', insertErr.message)
    return { ok: false, error: 'Your WhatsApp account connected with Meta, but saving it to your Wapaci account failed. Please try connecting again — if this keeps happening, contact support.' }
  }

  if (store) {
    await service.from('stores').update({
      whatsapp_number:  info.displayPhoneNumber,
      whatsapp_bsp:     'meta',
      whatsapp_api_key: info.accessToken,
      updated_at:       new Date().toISOString(),
    }).eq('id', store.id)
  }

  // Auto-provision Wapaci starter templates in the merchant's WABA.
  // Fire-and-forget — doesn't block the response. Templates are usually
  // auto-approved by Meta within minutes.
  const provisionToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? info.accessToken
  provisionStarterTemplates(info.wabaId, provisionToken)
    .then(results => console.log('[Meta callback] starter templates:', JSON.stringify(results)))
    .catch(e => console.warn('[Meta callback] template provisioning failed:', e))

  console.log(`[Meta callback] done — token_type=${tokenType} storeUpdated=${!!store}`)
  return { ok: true, phone: info.displayPhoneNumber, debug: result.debug }
}

// ─── POST — FB JS SDK Embedded Signup flow ────────────────────────────────────
// Client POSTs { code } after FB.login() completes. No redirect_uri needed.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Owner/admin only, same tier as every other WhatsApp-connection mutation
  // — this wrote whatsapp_accounts/stores keyed by the CALLER's own id with
  // no role check at all, so a team member completing this flow created a
  // stray row under their own id (nothing else reads it — every lookup
  // resolves to the org owner's row) instead of either actually connecting
  // the org's WhatsApp or being told they can't.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Only the account owner or an admin can connect WhatsApp.' }, { status: 403 })
  }
  const ownerId = await resolveOwnerUserId(createServiceClient(), user.id)

  const body = await request.json().catch(() => ({})) as {
    code?:                string
    sessionInfo?:         MetaSessionInfo
    connectionMode?:      'cloud_api' | 'coexistence'
    rawAuthResponseKeys?: string[]
    rawAuthResponse?:     Record<string, unknown>
  }
  if (!body.code) return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })

  // Log key names only — never log the raw authResponse values (may contain OAuth tokens)
  console.log('[Meta callback] rawAuthResponseKeys:', JSON.stringify(body.rawAuthResponseKeys ?? []))
  console.log('[Meta callback] sessionInfo received:', JSON.stringify(body.sessionInfo ?? null))
  console.log('[Meta callback] connectionMode:', body.connectionMode ?? 'cloud_api')

  const result = await processMetaCode(
    body.code, undefined, ownerId, body.sessionInfo, body.rawAuthResponseKeys, body.rawAuthResponse,
    body.connectionMode ?? 'cloud_api',
  )
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

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent('Only the account owner or an admin can connect WhatsApp.')}`
    )
  }
  const ownerId = await resolveOwnerUserId(createServiceClient(), user.id)

  const redirectUri = `${origin}/api/meta/callback`
  const result      = await processMetaCode(code, redirectUri, ownerId)

  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent(result.error)}`
    )
  }

  return NextResponse.redirect(`${origin}/dashboard/settings?tab=whatsapp&connected=meta`)
}

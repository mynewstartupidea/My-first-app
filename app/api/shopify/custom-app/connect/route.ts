import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'
import { validateShopDomain, syncShopifyCustomers, registerWebhooks, getShopifyAppUrl } from '@/lib/shopify'
import { encrypt } from '@/lib/encryption'
import {
  requestAccessToken,
  validateMissingScopes,
  testGraphQLConnection,
  REQUIRED_SCOPES,
  ShopifyConnectionError,
} from '@/lib/shopify-custom-app'

// POST /api/shopify/custom-app/connect — connects a merchant's own
// Shopify custom app (created via their dev dashboard) using the client
// credentials grant, instead of the public-app OAuth flow in
// app/api/shopify/callback/route.ts (kept intact, untouched, dormant).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { connected: false, error: 'FORBIDDEN', message: 'Only the account owner or an admin can connect a store.' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({})) as {
    shop?: string
    clientId?: string
    clientSecret?: string
  }

  let shop = (body.shop ?? '').trim().toLowerCase()
  const clientId = (body.clientId ?? '').trim()
  const clientSecret = (body.clientSecret ?? '').trim()

  if (!shop.includes('.myshopify.com') && shop) shop = `${shop}.myshopify.com`

  if (!shop || !clientId || !clientSecret) {
    return NextResponse.json(
      { connected: false, error: 'INVALID_SHOP_DOMAIN', message: 'Shop domain, client id and client secret are all required.' },
      { status: 400 },
    )
  }
  if (!validateShopDomain(shop)) {
    return NextResponse.json(
      { connected: false, error: 'INVALID_SHOP_DOMAIN', message: `"${shop}" is not a valid *.myshopify.com domain.` },
      { status: 400 },
    )
  }

  try {
    // 1. Exchange client credentials for an access token
    const tokenData = await requestAccessToken(shop, clientId, clientSecret)

    // 2. Validate granted scopes — missing ones are informational unless a
    // scope this phase actually depends on (read_customers) is absent.
    const { granted, missing } = validateMissingScopes(tokenData.scope)
    const missingRequired = REQUIRED_SCOPES.filter(s => !granted.includes(s))
    if (missingRequired.length > 0) {
      return NextResponse.json({
        connected: false,
        error: 'MISSING_SCOPE',
        message: `This custom app is missing required scope(s): ${missingRequired.join(', ')}.`,
        missing_scopes: missingRequired,
      }, { status: 400 })
    }

    // 3. Confirm the token actually works against the Admin GraphQL API
    const shopDetails = await testGraphQLConnection(shop, tokenData.access_token)

    // 4. Save — owner/admin-resolved, service client (same pattern as every
    // other settings route; team members connecting on behalf of the org
    // write to the org owner's store row, not their own).
    const service = createServiceClient()
    const ownerId = await resolveOwnerUserId(service, user.id)
    const now = new Date().toISOString()

    const payload = {
      shopify_domain: shop,
      shopify_connection_type: 'custom_app',
      shopify_client_id: clientId,
      shopify_client_secret_enc: encrypt(clientSecret),
      shopify_access_token_enc: encrypt(tokenData.access_token),
      shopify_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      shopify_granted_scopes: granted,
      shop_name: shopDetails.name,
      shop_email: shopDetails.email ?? null,
      currency: shopDetails.currency ?? 'INR',
      platform: 'shopify',
      is_active: true,
      connected_at: now,
      updated_at: now,
    }

    const { data: existingStores } = await service
      .from('stores')
      .select('id, shopify_domain, connected_at, updated_at, created_at')
      .eq('user_id', ownerId)
      .eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10)
    const existing = pickPreferredStore(existingStores)

    // stores.shopify_domain has a unique constraint with no RLS/ownership
    // scoping — a disconnected store (is_active: false) from a past test,
    // a different account, or even an earlier failed attempt by this same
    // merchant keeps permanently holding that domain forever unless
    // something explicitly releases it. Confirmed live: a store from an
    // unrelated account, disconnected back in June, still blocked a brand
    // new connection attempt to the exact same domain with an opaque
    // "could not save your store" error — the real cause (a Postgres
    // unique-constraint violation) was never surfaced.
    //
    // This check-then-release-then-write isn't atomic, so two connect
    // requests for the exact same domain within milliseconds of each other
    // could both pass the check before either writes. That's fine — the
    // real unique constraint still catches it at the write below, and
    // releaseStaleDomainHolder() is re-run with fresh data on that specific
    // conflict so the retry sees who actually won and behaves correctly
    // either way, instead of silently racing.
    async function releaseStaleDomainHolder(excludeId: string | undefined) {
      const { data: domainHolder } = await service
        .from('stores').select('id, user_id, is_active')
        .eq('shopify_domain', shop)
        .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000')
        .maybeSingle()
      if (!domainHolder) return
      if (domainHolder.is_active) {
        throw new ShopifyConnectionError(
          'SHOPIFY_API_ERROR',
          `${shop} is already connected to a different Wapaci account. Disconnect it there first, or contact support@wapaci.com if that's unexpected.`,
        )
      }
      // Stale/disconnected — release its claim on this domain so the real
      // connection below can take it. The row itself is left alone
      // otherwise; it's an inactive store, not being deleted here.
      const { error: releaseErr } = await service.from('stores').update({ shopify_domain: null }).eq('id', domainHolder.id)
      if (releaseErr) {
        console.error('[shopify/custom-app/connect] failed to release stale domain holder:', releaseErr.message)
        throw new ShopifyConnectionError('SHOPIFY_API_ERROR', "Couldn't connect this store — please try again or contact support@wapaci.com.")
      }
    }
    await releaseStaleDomainHolder(existing?.id)

    async function writeStore(attempt: number): Promise<string> {
      const { data, error } = existing
        ? await service.from('stores').update(payload).eq('id', existing.id).select('id').single()
        : await service.from('stores').insert({ user_id: ownerId, ...payload }).select('id').single()
      if (error || !data) {
        // 23505 on shopify_domain here means the pre-check above lost a
        // genuine race to another request. Re-check who holds the domain
        // now (fresh read) and retry exactly once — if that other request
        // was for a different, still-active account, this correctly surfaces
        // the "already connected elsewhere" message instead of retrying
        // blindly; if it was stale, the retry proceeds normally.
        if (error?.code === '23505' && error.message.includes('shopify_domain') && attempt === 0) {
          await releaseStaleDomainHolder(existing?.id)
          return writeStore(attempt + 1)
        }
        console.error('[shopify/custom-app/connect] store save failed:', error?.message)
        throw new ShopifyConnectionError('SHOPIFY_API_ERROR', 'Connected to Shopify, but could not save your store. Please try again.')
      }
      return data.id
    }
    const storeId = await writeStore(0)

    // 5. Kick off initial customer sync — fire-and-forget, same pattern as
    // the OAuth callback route. Small/fast enough (paginated, capped at 4
    // pages) to not need the job-queue treatment below.
    syncShopifyCustomers(shop, tokenData.access_token, storeId, service, 4).catch(e =>
      console.error('[shopify/custom-app/connect] customer sync error:', e)
    )

    // 6. Register webhooks for incremental updates — this is what actually
    // drives the existing abandoned-cart/order-confirmation/COD/shipping/
    // upsell/review automations (app/api/shopify/webhooks/route.ts) for this
    // store going forward, not just data mirroring.
    registerWebhooks(shop, tokenData.access_token, getShopifyAppUrl()).catch(e =>
      console.error('[shopify/custom-app/connect] webhook registration error:', e)
    )

    // 7. Enqueue background sync jobs for everything too large/slow to do
    // inline (orders/products/inventory/etc.) — processed page-by-page by
    // app/api/cron/shopify-sync so a large store's history never risks
    // running past a single request's time limit. locations is enqueued
    // first and inventory last since inventory sync depends on locations
    // already existing (see lib/shopify-sync.ts).
    // returns is deliberately not a standalone job — it's synced inline
    // inside the orders job (see lib/shopify-sync.ts), since Shopify only
    // exposes returns nested under an order, not as a root-level query.
    const resources = ['locations', 'products', 'orders', 'abandoned_checkouts', 'discounts', 'inventory']
    const { error: jobsError } = await service.from('shopify_sync_jobs').insert(
      resources.map(resource => ({ store_id: storeId, resource, status: 'pending' as const }))
    )
    if (jobsError) console.error('[shopify/custom-app/connect] sync job enqueue error:', jobsError.message)

    return NextResponse.json({
      connected: true,
      shop,
      granted_scopes: granted,
      missing_scopes: missing,
      initial_sync_status: 'started',
    })
  } catch (err) {
    if (err instanceof ShopifyConnectionError) {
      // INVALID_CREDENTIALS / SHOP_NOT_PERMITTED / MISSING_SCOPE messages are
      // already written for a merchant to read. SHOPIFY_API_ERROR can carry a
      // raw fetch/HTTP error (e.g. "GraphQL request failed: TypeError: fetch
      // failed") — not shown verbatim. TOKEN_REQUEST_FAILED's message is
      // either Shopify's own OAuth error_description (standard, safe —
      // feedback about credentials the merchant just typed in themselves,
      // not a secret) or a network-reachability message if the request
      // never got a response at all — both are genuinely useful for
      // self-diagnosing a setup error. Previously fully generic, which made
      // "why is this failing" impossible to answer without server logs.
      console.error('[shopify/custom-app/connect]', err.code, err.message)
      const safeMessage =
        err.code === 'TOKEN_REQUEST_FAILED' ? `Couldn't get an access token from Shopify: ${err.message}. Double-check the client ID/secret, and make sure the app is actually installed on this store (Shopify dev dashboard → your app → Install app).` :
        err.code === 'SHOPIFY_API_ERROR'    ? err.message.startsWith('Connected to Shopify')
          ? err.message
          : "Couldn't verify the connection with Shopify. Please try again." :
        err.message
      return NextResponse.json({ connected: false, error: err.code, message: safeMessage }, { status: 400 })
    }
    console.error('[shopify/custom-app/connect] unexpected error:', err)
    return NextResponse.json(
      { connected: false, error: 'SHOPIFY_API_ERROR', message: 'Something went wrong connecting to Shopify. Please try again.' },
      { status: 500 },
    )
  }
}

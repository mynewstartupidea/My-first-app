import { NextResponse } from 'next/server'
import { getShopifyOAuthUrl, getShopifyRedirectUri, validateShopDomain, signOAuthState } from '@/lib/shopify'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')

  if (!shop) return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  if (!validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain — must be *.myshopify.com' }, { status: 400 })
  }

  const returnTo = searchParams.get('returnTo') ?? '/dashboard'

  // If the merchant is already signed into Wapaci, include their userId so the
  // callback can link the store to their account without creating a new one.
  // If they are not signed in (fresh App Store install), we omit userId and the
  // callback will auto-create/find their account using the shop email.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log(`[Shopify install] shop=${shop} user=${user?.id ?? 'new-merchant'}`)

  const statePayload: Record<string, string> = { shop, returnTo }
  if (user) {
    // Owner/admin only, same tier as disconnect and every other Shopify-
    // connection mutation — the state's userId used to be the CALLER's own
    // id unconditionally. The callback links the resulting store straight
    // to that id, so a Manager (who has /dashboard/shopify nav access)
    // completing this flow would attach a real Shopify connection to their
    // own account instead of the org's — invisible to every owner-scoped
    // lookup elsewhere in the app, not just a silent no-op like disconnect
    // was, since inserts don't need an existing row to match. Checked before
    // the config-missing check below so who's asking is settled before
    // whether the integration even works.
    const role = await getUserRole(user.id, user.email ?? '')
    if (role !== 'owner' && role !== 'admin') {
      const dest = new URL(`${new URL(request.url).origin}/dashboard/integrations`)
      dest.searchParams.set('shopify', 'permission_denied')
      return NextResponse.redirect(dest.toString())
    }
    const ownerId = await resolveOwnerUserId(createServiceClient(), user.id)
    statePayload.userId = ownerId
  }

  const missing = [
    ['SHOPIFY_API_KEY', process.env.SHOPIFY_API_KEY],
    ['SHOPIFY_API_SECRET', process.env.SHOPIFY_API_SECRET],
    ['SHOPIFY_SCOPES', process.env.SHOPIFY_SCOPES],
  ].filter(([, value]) => !value).map(([key]) => key)

  if (missing.length > 0) {
    return NextResponse.json({
      error: `Shopify app not configured. Missing: ${missing.join(', ')}`,
      redirect_uri: getShopifyRedirectUri(),
    }, { status: 500 })
  }

  const state    = signOAuthState(statePayload)
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  return NextResponse.redirect(oauthUrl)
}

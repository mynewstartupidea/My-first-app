import { NextResponse } from 'next/server'
import { getShopifyOAuthUrl, getShopifyRedirectUri, validateShopDomain, signOAuthState } from '@/lib/shopify'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')

  if (!shop) return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  if (!validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain — must be *.myshopify.com' }, { status: 400 })
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

  const returnTo = searchParams.get('returnTo') ?? '/dashboard'

  // If the merchant is already signed into Wapaci, include their userId so the
  // callback can link the store to their account without creating a new one.
  // If they are not signed in (fresh App Store install), we omit userId and the
  // callback will auto-create/find their account using the shop email.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log(`[Shopify install] shop=${shop} user=${user?.id ?? 'new-merchant'}`)

  const statePayload: Record<string, string> = { shop, returnTo }
  if (user) statePayload.userId = user.id

  const state    = signOAuthState(statePayload)
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  return NextResponse.redirect(oauthUrl)
}

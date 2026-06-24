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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log(`[Shopify install] shop=${shop} user=${user?.id ?? 'null'} cookies=${request.headers.get('cookie') ? 'present' : 'missing'}`)
  if (!user) {
    // Preserve the full install URL so after login the OAuth flow continues automatically
    const returnTo = searchParams.get('returnTo') ?? '/dashboard/integrations'
    const resumeUrl = `/api/shopify/install?shop=${encodeURIComponent(shop)}&returnTo=${encodeURIComponent(returnTo)}`
    console.log(`[Shopify install] unauthenticated — redirecting to login with returnTo`)
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(resumeUrl)}`, request.url))
  }

  const returnTo  = searchParams.get('returnTo') ?? '/dashboard/integrations'
  const state     = signOAuthState({ userId: user.id, shop, returnTo })
  const oauthUrl  = getShopifyOAuthUrl(shop, state)

  return NextResponse.redirect(oauthUrl)
}

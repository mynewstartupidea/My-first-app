import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShopifyOAuthUrl, validateShopDomain, signOAuthState } from '@/lib/shopify'

interface Props {
  searchParams: Promise<{ shop?: string; returnTo?: string; popup?: string }>
}

export default async function ConnectShopifyPage({ searchParams }: Props) {
  const { shop, returnTo = '/dashboard/integrations', popup } = await searchParams

  if (!shop || !validateShopDomain(shop)) {
    redirect('/dashboard/integrations?shopify=invalid_shop')
  }

  const missing = [
    ['SHOPIFY_API_KEY', process.env.SHOPIFY_API_KEY],
    ['SHOPIFY_API_SECRET', process.env.SHOPIFY_API_SECRET],
    ['SHOPIFY_SCOPES', process.env.SHOPIFY_SCOPES],
  ].filter(([, value]) => !value).map(([key]) => key)

  if (missing.length > 0) {
    redirect('/dashboard/integrations?shopify=not_configured')
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  console.log(`[shopify/connect] shop=${shop} user=${user?.id ?? 'null'} error=${error?.message ?? 'none'}`)

  if (!user) {
    console.log('[shopify/connect] no user — redirecting to login')
    redirect('/login')
  }

  const state = signOAuthState({ userId: user.id, shop, returnTo, popup: popup === '1' ? '1' : '' })
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  redirect(oauthUrl)
}

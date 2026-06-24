import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShopifyOAuthUrl, validateShopDomain, signOAuthState } from '@/lib/shopify'

interface Props {
  searchParams: Promise<{ shop?: string; returnTo?: string }>
}

export default async function ConnectShopifyPage({ searchParams }: Props) {
  const { shop, returnTo = '/dashboard/integrations' } = await searchParams

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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const state = signOAuthState({ userId: user.id, shop, returnTo })
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  redirect(oauthUrl)
}

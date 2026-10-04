import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getShopifyOAuthUrl, validateShopDomain, signOAuthState } from '@/lib/shopify'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

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

  // Owner/admin only, same tier as the custom-app connect flow
  // (api/shopify/custom-app/connect) — this is the OAuth entry point for the
  // legacy public-app flow, and had no role check at all. Worse: it signed
  // the OAuth state with the CALLER's raw user.id, which the callback
  // (app/api/shopify/callback) uses verbatim as the store owner with no
  // owner-resolution of its own — so any team member completing this flow
  // got a brand-new store connected under THEIR OWN id instead of the org's,
  // completely bypassing the org structure. Resolving to the owner's id here
  // (before the state is even signed) fixes both: only an owner/admin can
  // reach Shopify's consent screen, and whichever of them completes it
  // attaches the store to the right account.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    console.log(`[shopify/connect] role=${role} — not owner/admin, redirecting`)
    redirect('/dashboard/integrations?shopify=permission_denied')
  }
  const ownerId = await resolveOwnerUserId(createServiceClient(), user.id)

  const state = signOAuthState({ userId: ownerId, shop, returnTo, popup: popup === '1' ? '1' : '' })
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  redirect(oauthUrl)
}

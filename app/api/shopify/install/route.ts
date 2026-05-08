import { NextResponse } from 'next/server'
import { getShopifyOAuthUrl } from '@/lib/shopify'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')

  if (!shop) return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  if (!process.env.SHOPIFY_API_KEY) {
    return NextResponse.json({ error: 'Shopify app not configured. Add SHOPIFY_API_KEY to environment variables.' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const state = Buffer.from(JSON.stringify({ userId: user.id, shop })).toString('base64')
  const oauthUrl = getShopifyOAuthUrl(shop, state)

  return NextResponse.redirect(oauthUrl)
}

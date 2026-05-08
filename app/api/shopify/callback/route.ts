import { NextResponse } from 'next/server'
import { exchangeCodeForToken, getShopDetails, registerWebhooks } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const shop  = searchParams.get('shop')
  const state = searchParams.get('state')

  if (!code || !shop || !state) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=invalid_callback`)
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=invalid_state`)
  }

  try {
    const accessToken  = await exchangeCodeForToken(shop, code)
    const shopDetails  = await getShopDetails(shop, accessToken)
    const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? origin
    await registerWebhooks(shop, accessToken, appUrl)

    const supabase = createServiceClient()

    const { data: store, error } = await supabase
      .from('stores')
      .upsert({
        user_id:               userId,
        shopify_domain:        shop,
        shopify_access_token:  accessToken,
        shop_name:             shopDetails.name,
        shop_email:            shopDetails.email,
        currency:              shopDetails.currency ?? 'INR',
        is_active:             true,
        updated_at:            new Date().toISOString(),
      }, { onConflict: 'shopify_domain' })
      .select('id')
      .single()

    if (error) throw error

    // Create default automations
    await supabase.rpc('create_default_automations', { p_store_id: store.id })

    return NextResponse.redirect(`${origin}/dashboard?connected=1`)
  } catch (err) {
    console.error('Shopify OAuth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=oauth_failed`)
  }
}

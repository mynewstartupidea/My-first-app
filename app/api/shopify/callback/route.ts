import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { exchangeCodeForToken, getShopDetails, getShopifyAppUrl, registerWebhooks, syncShopifyCustomers, verifyShopifyOAuthCallback, verifyOAuthState } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'

function redirectWithStatus(origin: string, returnTo: string, status: string) {
  const isSuccess = status === 'connected'
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/dashboard/integrations'
  const basePath  = isSuccess ? '/shopify/complete' : '/dashboard/integrations'
  const dest = new URL(`${origin}${basePath}`)
  dest.searchParams.set('shopify', status)
  if (isSuccess) dest.searchParams.set('returnTo', safeReturnTo)
  return NextResponse.redirect(dest.toString())
}

function redirectWithPopupStatus(origin: string, returnTo: string, status: string, popup: string) {
  const response = redirectWithStatus(origin, returnTo, status)
  if (status !== 'connected' || popup !== '1') return response

  const location = response.headers.get('location')
  if (!location) return response

  const dest = new URL(location)
  dest.searchParams.set('popup', '1')
  return NextResponse.redirect(dest.toString())
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const shop  = searchParams.get('shop')
  const state = searchParams.get('state')

  console.log(`[Shopify OAuth] callback — shop: ${shop}`)

  if (!code || !shop || !state) {
    console.error('[Shopify OAuth] missing code/shop/state params')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_callback')
  }

  if (!verifyShopifyOAuthCallback(searchParams)) {
    console.error('[Shopify OAuth] HMAC verification failed — possible forgery')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_hmac')
  }

  const decoded = verifyOAuthState(state)
  if (!decoded) {
    console.error('[Shopify OAuth] invalid or tampered state param')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_state')
  }

  const returnTo = decoded.returnTo ?? '/dashboard'
  const popup    = decoded.popup === '1' ? '1' : ''

  try {
    // 1. Exchange code for access token
    let accessToken: string
    try {
      accessToken = await exchangeCodeForToken(shop, code)
    } catch (err) {
      console.error('[Shopify OAuth] token exchange failed:', err)
      return redirectWithStatus(origin, returnTo, 'token_failed')
    }
    console.log('[Shopify OAuth] token exchange: OK')

    // 2. Fetch shop details (name, email — never throws)
    const shopDetails = await getShopDetails(shop, accessToken)
    console.log(`[Shopify OAuth] shop name: ${shopDetails.name} email: ${shopDetails.email ?? 'none'}`)

    // 3. Register webhooks
    const appUrl = getShopifyAppUrl()
    await registerWebhooks(shop, accessToken, appUrl)
    console.log('[Shopify OAuth] webhooks registered')

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // 4. Determine userId — either from signed state (existing user) or auto-create
    let userId: string
    let isBrandNewMerchant = false
    // Only a genuinely brand-new, never-confirmed account needs the email-code
    // gate below — a re-install of an already-verified account (or an existing
    // Wapaci user linking Shopify from inside the app, the decoded.userId
    // branch) isn't a new identity to prove, just a returning one.
    let needsEmailVerification = false
    let merchantEmail: string | null = null

    if (decoded.userId) {
      // Existing Wapaci user connecting / reconnecting their store
      userId = decoded.userId
      console.log('[Shopify OAuth] existing user:', userId)
    } else {
      // New merchant from App Store — find or create Wapaci account using shop email
      isBrandNewMerchant = true
      merchantEmail = shopDetails.email ?? null

      // Check if this shop domain is already linked to a Wapaci account
      const { data: existingStore } = await supabase
        .from('stores')
        .select('user_id')
        .eq('shopify_domain', shop)
        .limit(1)
        .maybeSingle()

      if (existingStore?.user_id) {
        // Re-install: reuse existing account, still need magic link (no browser session yet)
        userId = existingStore.user_id
        console.log('[Shopify OAuth] re-install — reusing existing user:', userId)

        // Get their email for magic link
        const { data: { user: existingUser } } = await supabase.auth.admin.getUserById(userId)
        merchantEmail = existingUser?.email ?? merchantEmail
      } else if (!merchantEmail) {
        // Shopify didn't hand over a real email at all — there is nothing to
        // verify, so this must NOT auto-create an account (that used to fall
        // back to a fabricated @shopify-install.wapaci.com address nobody
        // could ever receive a code at, which is worse than just asking them
        // to sign up properly). Send them through the normal signup form —
        // same real-email-verification path as everyone else — and they can
        // reconnect Shopify from Integrations once they're a real account.
        console.log('[Shopify OAuth] no email from Shopify — sending merchant through normal signup')
        return NextResponse.redirect(`${origin}/signup?shop=${encodeURIComponent(shop)}`)
      } else {
        // Brand new merchant, real email available — create the account
        // UNCONFIRMED. This is the same anti-fake-signup gate as the direct
        // /signup form: a Shopify App Store install proves they're logged
        // into a real Shopify admin, but not that shopDetails.email is an
        // inbox they currently control, so it still needs its own code.
        const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
          email:          merchantEmail,
          email_confirm:  false,
          password:       crypto.randomBytes(24).toString('hex'),
          user_metadata:  { shop, source: 'shopify_install', shop_name: shopDetails.name },
        })

        if (createErr || !newUserData.user) {
          console.error('[Shopify OAuth] auto-createUser failed:', createErr?.message)
          // Fall back: redirect to login so merchant can create an account manually
          return NextResponse.redirect(
            `${origin}/login?returnTo=${encodeURIComponent(`/api/shopify/install?shop=${encodeURIComponent(shop)}`)}`
          )
        }

        userId = newUserData.user.id
        needsEmailVerification = true
        console.log('[Shopify OAuth] auto-created unconfirmed Wapaci account:', userId, 'email:', merchantEmail)
      }
    }

    // 5. Save / update store record
    const shopifyPayload = {
      shopify_domain:       shop,
      shopify_access_token: accessToken,
      shop_name:            shopDetails.name,
      shop_email:           shopDetails.email ?? null,
      currency:             shopDetails.currency ?? 'INR',
      platform:             'shopify',
      is_active:            true,
      connected_at:         now,
      updated_at:           now,
    }

    let storeId: string

    const { data: byDomain } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('shopify_domain', shop)
      .maybeSingle()

    if (byDomain) {
      const { data, error } = await supabase
        .from('stores').update(shopifyPayload).eq('id', byDomain.id).select('id').single()
      if (error) {
        console.error('[Shopify OAuth] store update failed:', error)
        return redirectWithStatus(origin, returnTo, 'store_failed')
      }
      storeId = data.id
      console.log('[Shopify OAuth] updated existing store:', storeId)
    } else {
      const { data: rows } = await supabase
        .from('stores').select('id').eq('user_id', userId).eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1)
      const existing = rows?.[0]

      if (existing) {
        const { data, error } = await supabase
          .from('stores').update(shopifyPayload).eq('id', existing.id).select('id').single()
        if (error) {
          console.error('[Shopify OAuth] store upgrade failed:', error)
          return redirectWithStatus(origin, returnTo, 'store_failed')
        }
        storeId = data.id
        console.log('[Shopify OAuth] upgraded existing store:', storeId)
      } else {
        const { data, error } = await supabase
          .from('stores').insert({ user_id: userId, ...shopifyPayload }).select('id').single()
        if (error) {
          console.error('[Shopify OAuth] store insert failed:', error)
          return redirectWithStatus(origin, returnTo, 'store_failed')
        }
        storeId = data.id
        console.log('[Shopify OAuth] created new store:', storeId)
      }
    }

    // 6. Deactivate any duplicate stores for this user
    await supabase
      .from('stores')
      .update({ is_active: false, updated_at: now })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('id', storeId)

    // 7. Ensure default automations
    await supabase.rpc('create_default_automations', { p_store_id: storeId })

    // 8. Backfill existing customers
    syncShopifyCustomers(shop, accessToken, storeId, supabase, 4).catch(e =>
      console.error('[Shopify OAuth] customer sync error:', e)
    )

    // 9. Check billing
    const { data: billing } = await supabase
      .from('billing')
      .select('status, billing_provider')
      .eq('user_id', userId)
      .maybeSingle()

    const hasShopifyBilling = billing?.billing_provider === 'shopify' &&
      (billing?.status === 'active' || billing?.status === 'trialing')

    const pricingUrl = `${origin}/shopify/pricing?shop=${encodeURIComponent(shop)}`
    const nextPath = hasShopifyBilling ? '/dashboard' : `/shopify/pricing?shop=${encodeURIComponent(shop)}`

    // 10. Brand-new, just-created account — same anti-fake-signup gate as the
    //     direct /signup form: no magic link, no dashboard access, until they
    //     prove they actually control this inbox via a real emailed code.
    if (needsEmailVerification && merchantEmail) {
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: merchantEmail })
      if (resendErr) console.error('[Shopify OAuth] verification email send failed:', resendErr.message)
      console.log('[Shopify OAuth] new merchant — sent verification code, redirecting to /shopify/verify')
      return NextResponse.redirect(
        `${origin}/shopify/verify?email=${encodeURIComponent(merchantEmail)}&next=${encodeURIComponent(nextPath)}`
      )
    }

    // 11. Re-install of an already-verified account — sign them back in via
    //     magic link, same convenience as any other "you're already you"
    //     link-based auth in this app (not a new identity to prove).
    if (isBrandNewMerchant && merchantEmail) {
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type:    'magiclink',
        email:   merchantEmail,
        options: { redirectTo },
      })

      if (!linkErr && linkData?.properties?.action_link) {
        console.log('[Shopify OAuth] returning merchant — redirecting via magic link')
        return NextResponse.redirect(linkData.properties.action_link)
      }

      // Magic link failed — fall back to login with returnTo
      console.error('[Shopify OAuth] generateLink failed:', linkErr?.message)
      return NextResponse.redirect(
        `${origin}/login?returnTo=${encodeURIComponent(nextPath)}`
      )
    }

    // 11. Existing user — normal redirect
    if (!hasShopifyBilling) {
      console.log('[Shopify OAuth] no billing — redirecting to pricing')
      return NextResponse.redirect(pricingUrl)
    }

    console.log('[Shopify OAuth] success — redirecting')
    return redirectWithPopupStatus(origin, returnTo, 'connected', popup)

  } catch (err) {
    console.error('[Shopify OAuth] error:', err)
    return redirectWithStatus(origin, returnTo, 'oauth_failed')
  }
}

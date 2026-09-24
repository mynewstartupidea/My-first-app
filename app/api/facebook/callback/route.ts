import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { exchangeFBCode, getLongLivedToken, getUserPages } from '@/lib/facebook'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=denied`)
  }

  const cookieStore = await cookies()

  // Verify OAuth state to prevent CSRF
  const state       = searchParams.get('state')
  const storedState = cookieStore.get('fb_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=error`)
  }

  const callbackUrl = cookieStore.get('fb_oauth_callback')?.value ?? `${origin}/api/facebook/callback`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?returnTo=/dashboard/leads`)

  try {
    const shortToken = await exchangeFBCode(code, callbackUrl)
    const longToken  = await getLongLivedToken(shortToken)
    const pages      = await getUserPages(longToken)

    if (!pages.length) {
      return NextResponse.redirect(`${origin}/dashboard/leads?fb=no_pages`)
    }

    const service = createServiceClient()
    // If an admin teammate connects Facebook on the org's behalf, the connection
    // (and the store it links to) must belong to the actual owner — otherwise it's
    // invisible to every route that reads facebook_connections by the owner's id.
    const ownerId = await resolveOwnerUserId(service, user.id)
    const { data: store } = await service
      .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true).maybeSingle()

    const { data: existingRows } = await service
      .from('facebook_connections')
      .select('page_id, selection_status')
      .eq('user_id', ownerId)
    const activePageIds = new Set((existingRows ?? []).filter(r => r.selection_status === 'active').map(r => r.page_id))

    let newlyPendingCount = 0

    for (const page of pages) {
      if (activePageIds.has(page.id)) {
        // Already connected and selected — just refresh the tokens/name, don't
        // touch subscription state or re-run the picker for it.
        await service
          .from('facebook_connections')
          .update({ page_name: page.name, page_access_token: page.access_token, user_access_token: longToken, updated_at: new Date().toISOString() })
          .eq('user_id', ownerId).eq('page_id', page.id)
        continue
      }

      // New (or previously-declined) page — land it as 'pending'. It isn't
      // subscribed to lead sync and has no automations registered until the
      // merchant explicitly picks it in the page-selection screen.
      await service
        .from('facebook_connections')
        .upsert({
          user_id:               ownerId,
          store_id:              store?.id ?? null,
          page_id:               page.id,
          page_name:             page.name,
          page_access_token:     page.access_token,
          user_access_token:     longToken,
          subscribed_to_leadgen: false,
          selection_status:      'pending',
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'user_id,page_id' })
      newlyPendingCount++
    }

    console.log(`[Facebook] discovered ${pages.length} pages for user ${user.id} — ${newlyPendingCount} pending selection`)

    if (newlyPendingCount > 0) {
      return NextResponse.redirect(`${origin}/dashboard/leads?fb=choose_pages`)
    }
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=connected&pages=${activePageIds.size}`)
  } catch (err) {
    console.error('[Facebook] callback error:', err)
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=error`)
  }
}

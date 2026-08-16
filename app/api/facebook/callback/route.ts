import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { exchangeFBCode, getLongLivedToken, getUserPages, subscribePageToLeadgen } from '@/lib/facebook'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=denied`)
  }

  const cookieStore = await cookies()
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
    const { data: store } = await service
      .from('stores').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()

    for (const page of pages) {
      const subscribed = await subscribePageToLeadgen(page.id, page.access_token)
      await service.from('facebook_connections').upsert({
        user_id:               user.id,
        store_id:              store?.id ?? null,
        page_id:               page.id,
        page_name:             page.name,
        page_access_token:     page.access_token,
        subscribed_to_leadgen: subscribed,
        updated_at:            new Date().toISOString(),
      }, { onConflict: 'user_id,page_id' })
    }

    console.log(`[Facebook] connected ${pages.length} pages for user ${user.id}`)
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=connected&pages=${pages.length}`)
  } catch (err) {
    console.error('[Facebook] callback error:', err)
    return NextResponse.redirect(`${origin}/dashboard/leads?fb=error`)
  }
}

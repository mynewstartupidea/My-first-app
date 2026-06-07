export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await provisionStore(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

async function provisionStore(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) return

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_name, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const shopName =
      profile?.company_name ||
      (user.user_metadata?.company_name as string | undefined) ||
      'My Store'

    const { data: store } = await supabase
      .from('stores')
      .insert({
        user_id:      user.id,
        shop_name:    shopName,
        is_active:    true,
        whatsapp_bsp: 'mock',
        plan:         'starter',
      })
      .select('id')
      .single()

    if (store) {
      await supabase.rpc('create_default_automations', { p_store_id: store.id })
    }
  } catch {
    // Non-fatal — user can create store from Settings
  }
}

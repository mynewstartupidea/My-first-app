export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // An invited teammate accepting their invite must NOT also get
      // provisionStore's brand-new empty store below — getUserRole() checks
      // `stores` before `team_members`, so that would silently make them the
      // "owner" of an empty account instead of joining the org they were
      // actually invited into.
      const joinedTeam = await activateTeamInvite(supabase)
      if (!joinedTeam) await provisionStore(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

// team/invite (POST /api/team/invite) creates the team_members row as
// 'pending' and stores { role, organization_id, organization_name } in the
// invited user's auth metadata via inviteUserByEmail — nothing previously
// read that metadata back out, so a pending invite never actually activated:
// resolveOwnerUserId matches teammates by user_id (not email), which also
// never got set. Returns true when this login was an invite being accepted.
async function activateTeamInvite(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return false

    const organizationId = user.user_metadata?.organization_id as string | undefined
    if (!organizationId) return false

    const service = createServiceClient()
    const { data: updated } = await service
      .from('team_members')
      .update({ status: 'active', user_id: user.id })
      .eq('organization_id', organizationId)
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    return !!updated
  } catch {
    return false
  }
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

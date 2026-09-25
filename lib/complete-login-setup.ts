// Shared post-authentication setup — runs once a session actually exists,
// regardless of which flow established it (PKCE ?code= via /auth/callback,
// or a hash-fragment token completed client-side on the login page, since
// Supabase's invite/magic-link/reset emails redirect with tokens in the URL
// hash, which never reaches the server at all). Exactly one of these two
// outcomes happens per first login:
//
// 1. This login is an invited teammate accepting their invite — activate
//    the matching team_members row (status + user_id) and stop there. Must
//    NOT also fall through to provisioning a store: getUserRole() checks
//    `stores` before `team_members`, so a stray store would silently make
//    them the "owner" of an empty account instead of joining the org they
//    were actually invited into.
// 2. Anything else (a genuine first-time self-serve signup) — provision
//    their own store, same as before this existed.

import { createClient, createServiceClient } from '@/lib/supabase/server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function completeLoginSetup(supabase: ServerSupabaseClient): Promise<void> {
  const joinedTeam = await activateTeamInvite(supabase)
  if (!joinedTeam) await provisionStore(supabase)
}

async function activateTeamInvite(supabase: ServerSupabaseClient): Promise<boolean> {
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

async function provisionStore(supabase: ServerSupabaseClient) {
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

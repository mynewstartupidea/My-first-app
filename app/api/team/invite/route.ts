import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/get-app-url'

const VALID_ROLES = ['admin', 'manager', 'support', 'member'] as const
type Role = typeof VALID_ROLES[number]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const email: string = (body.email ?? '').trim().toLowerCase()
  const role: Role    = (body.role  ?? 'member').toLowerCase() as Role

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be admin, manager, support, or member.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Get or create organization for this owner
  let { data: org } = await service
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!org) {
    const [{ data: store }, { data: profile }] = await Promise.all([
      supabase.from('stores').select('shop_name').eq('user_id', user.id).eq('is_active', true)
        .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from('user_profiles').select('company_name').eq('id', user.id).maybeSingle(),
    ])
    const orgName = profile?.company_name ?? store?.shop_name ?? 'My Organization'
    const { data: newOrg, error: orgErr } = await service
      .from('organizations')
      .insert({ name: orgName, owner_id: user.id })
      .select('id, name').single()
    if (orgErr) return NextResponse.json({ error: 'Could not create organization' }, { status: 500 })
    org = newOrg
  }

  // Prevent duplicate invites
  const { data: existing } = await service
    .from('team_members')
    .select('id, status')
    .eq('organization_id', org.id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'An invite already exists for this email' }, { status: 409 })
  }

  // Insert team_members record first
  const { data: invite, error: invErr } = await service
    .from('team_members')
    .insert({ organization_id: org.id, email, role, status: 'pending', invited_by: user.id })
    .select('*')
    .single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  // Send actual invitation email via Supabase Auth Admin
  const { error: emailErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/dashboard`,
    data: {
      role,
      organization_id: org.id,
      organization_name: org.name,
      invited_by: user.email ?? user.id,
    },
  })

  if (emailErr) {
    // Don't fail the whole request — record is saved, but flag email issue
    console.error('[Invite] email send failed:', emailErr.message)
    return NextResponse.json({
      invite,
      warning: `Invite saved but email failed: ${emailErr.message}`,
    })
  }

  return NextResponse.json({ invite })
}

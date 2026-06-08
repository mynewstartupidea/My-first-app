import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const email: string = (body.email ?? '').trim().toLowerCase()
  const role: string  = (body.role  ?? 'member').toLowerCase()

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!['admin', 'manager', 'member', 'support'].includes(role)) {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  }

  const service = createServiceClient()

  // Get or create organization for this user
  let { data: org } = await service
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!org) {
    const [{ data: store }, { data: profile }] = await Promise.all([
      supabase.from('stores').select('shop_name').eq('user_id', user.id).eq('is_active', true).order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from('user_profiles').select('company_name').eq('id', user.id).maybeSingle(),
    ])
    const orgName = profile?.company_name ?? store?.shop_name ?? 'My Organization'

    const { data: newOrg, error: orgErr } = await service
      .from('organizations')
      .insert({ name: orgName, owner_id: user.id })
      .select('id')
      .single()

    if (orgErr) return NextResponse.json({ error: 'Could not create organization' }, { status: 500 })
    org = newOrg
  }

  // Check for duplicate invite
  const { data: existing } = await service
    .from('team_members')
    .select('id, status')
    .eq('organization_id', org.id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Invite already exists for this email' }, { status: 409 })
  }

  const { data: invite, error: invErr } = await service
    .from('team_members')
    .insert({ organization_id: org.id, email, role, status: 'pending' })
    .select('*')
    .single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({ invite })
}

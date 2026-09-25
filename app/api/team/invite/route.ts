import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/get-app-url'
import { resolveManagedOrg } from '@/lib/resolve-managed-org'

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

  // Get this user's existing org (owned, or as an active admin teammate — see
  // resolveManagedOrg). Only fall through to creating a brand-new organization for
  // a genuine first-time self-serve signup: previously this checked owner_id alone,
  // so an admin teammate inviting someone would silently spin up a second, separate
  // organization instead of adding to the one they already belong to.
  let org = await resolveManagedOrg(service, user.id, user.email ?? '')

  if (!org) {
    const { data: existingMembership } = await service
      .from('team_members').select('id').eq('email', user.email ?? '').eq('status', 'active').maybeSingle()
    if (existingMembership) {
      // An active teammate without invite rights (e.g. a Sales/Support/Manager role) — not a fresh signup.
      return NextResponse.json({ error: 'You do not have permission to invite team members.' }, { status: 403 })
    }

    const [{ data: store }, { data: profile }] = await Promise.all([
      supabase.from('stores').select('shop_name').eq('user_id', user.id).eq('is_active', true)
        .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from('user_profiles').select('company_name').eq('id', user.id).maybeSingle(),
    ])
    const orgName = profile?.company_name ?? store?.shop_name ?? 'My Organization'
    const { data: newOrg, error: orgErr } = await service
      .from('organizations')
      .insert({ name: orgName, owner_id: user.id })
      .select('*').single()
    if (orgErr) return NextResponse.json({ error: 'Could not create organization' }, { status: 500 })
    org = newOrg
  }
  if (!org) return NextResponse.json({ error: 'Could not resolve organization' }, { status: 500 })

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
    // inviteUserByEmail fails outright — not a soft warning, a hard error —
    // for any email that already has a confirmed account. This is exactly
    // what happens re-inviting someone after removing them: their first
    // acceptance already created a real, confirmed account with a password,
    // so Supabase's invite flow (meant only for brand-new accounts) will
    // never succeed for them again, and the pending row would sit there
    // forever with the merchant having no idea why the email never arrived.
    // Since they already have working credentials, skip the broken email
    // path and activate them immediately instead.
    const alreadyRegistered = /already.*registered/i.test(emailErr.message)
    if (alreadyRegistered) {
      const { data: userList } = await service.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = userList?.users.find(u => u.email?.toLowerCase() === email)
      if (existingUser) {
        await service
          .from('team_members')
          .update({ status: 'active', user_id: existingUser.id })
          .eq('id', invite.id)
        return NextResponse.json({
          invite: { ...invite, status: 'active', user_id: existingUser.id },
          alreadyActive: true,
          message: `${email} already has a Wapaci account and has been added back to the team immediately — they can log in right away with their existing password.`,
        })
      }
    }

    // Don't fail the whole request — record is saved, but flag email issue
    console.error('[Invite] email send failed:', emailErr.message)
    return NextResponse.json({
      invite,
      warning: `Invite saved but email failed: ${emailErr.message}`,
    })
  }

  return NextResponse.json({ invite })
}

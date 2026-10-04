import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'

// Backs the Templates page's "My Templates" CRUD — previously done via
// direct client-side queries against `templates`, whose RLS is USING
// (user_id = auth.uid()) with no team-member carve-out, so a teammate saw
// a permanently empty list and every clone/save/favorite/archive/delete
// silently failed (RLS blocks the write, no visible error).
//
// Templates is manager/admin/owner-only (lib/user-role.ts) — every verb
// here previously only checked for a logged-in user, so a 'member'/
// 'support' teammate (no Templates nav link) could still list, create,
// edit and delete templates by calling the API directly.

function canManageTemplates(role: string) {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (!canManageTemplates(role)) return NextResponse.json({ error: 'You don\'t have access to Templates.' }, { status: 403 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data } = await service.from('templates').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (!canManageTemplates(role)) return NextResponse.json({ error: 'You don\'t have access to Templates.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as {
    name?: string; body?: string; category?: string; variables?: string[]; is_builtin?: boolean
  }
  if (!body.name?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'name and body are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data, error } = await service.from('templates').insert({
    user_id: ownerId,
    name: body.name.trim(),
    body: body.body,
    category: body.category ?? 'custom',
    variables: body.variables ?? [],
    is_builtin: body.is_builtin ?? false,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (!canManageTemplates(role)) return NextResponse.json({ error: 'You don\'t have access to Templates.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { id?: string } & Record<string, unknown>
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { id, ...updates } = body

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data, error } = await service.from('templates').update(updates)
    .eq('id', id).eq('user_id', ownerId).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (!canManageTemplates(role)) return NextResponse.json({ error: 'You don\'t have access to Templates.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { error } = await service.from('templates').delete().eq('id', id).eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

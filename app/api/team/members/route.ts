import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: org } = await service
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ members: [], org: null })

  const { data: members } = await service
    .from('team_members')
    .select('*')
    .eq('organization_id', org.id)
    .order('invited_at', { ascending: false })

  return NextResponse.json({ members: members ?? [], org })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const service = createServiceClient()

  // Verify ownership through org
  const { data: org } = await service
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await service
    .from('team_members')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Update role
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, role } = body as { id: string; role: string }
  if (!id || !role) return NextResponse.json({ error: 'id and role required' }, { status: 400 })

  const service = createServiceClient()
  const { data: org } = await service
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await service
    .from('team_members')
    .update({ role })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

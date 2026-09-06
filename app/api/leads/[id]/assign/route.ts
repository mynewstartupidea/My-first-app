import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/leads/[id]/assign
// Body (all optional): { userId, userName }
//   userId   — assign to this user instead of self
//   userName — display name to store; if omitted, looked up from user_profiles
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { userId?: string; userName?: string }
  const targetId = body.userId ?? user.id

  const service = createServiceClient()

  let assignedName: string
  if (body.userName) {
    assignedName = body.userName
  } else {
    const { data: profile } = await service
      .from('user_profiles')
      .select('full_name')
      .eq('id', targetId)
      .maybeSingle()
    assignedName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Unknown'
  }

  const { error } = await service
    .from('leads')
    .update({ assigned_to: targetId, assigned_name: assignedName })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, assigned_name: assignedName })
}

// PATCH with ?unassign=true — remove assignment
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { error } = await service
    .from('leads')
    .update({ assigned_to: null, assigned_name: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

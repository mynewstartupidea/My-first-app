import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/leads/[id]/assign  — assign lead to the current user
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Resolve caller name from profile
  const { data: profile } = await service
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const assignedName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Unknown'

  // Update the lead — service client bypasses RLS so team members can assign too
  const { error } = await service
    .from('leads')
    .update({ assigned_to: user.id, assigned_name: assignedName })
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

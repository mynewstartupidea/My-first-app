export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

// PATCH — admin updates ticket status / adds notes
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as {
    status?:      string
    admin_notes?: string
  }

  const service = createServiceClient()
  const { error } = await service.from('support_tickets').update({
    ...(body.status      && { status: body.status }),
    ...(body.admin_notes !== undefined && { admin_notes: body.admin_notes }),
    updated_at: new Date().toISOString(),
    ...(body.status === 'resolved' && { resolved_at: new Date().toISOString() }),
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

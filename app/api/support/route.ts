export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST — submit a support ticket
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    subject?:  string
    category?: string
    message?:  string
    priority?: string
  }

  if (!body.subject?.trim())  return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  if (!body.message?.trim())  return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('support_tickets').insert({
    user_id:    user.id,
    user_email: user.email ?? '',
    subject:    body.subject.trim(),
    category:   body.category?.trim() ?? 'general',
    message:    body.message.trim(),
    priority:   body.priority ?? 'normal',
    status:     'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[Support] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// GET — list tickets for current user (or all if admin)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.email === (process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com')
  const service = createServiceClient()

  let query = service
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query.limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

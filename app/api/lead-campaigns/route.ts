import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: campaigns } = await service
    .from('lead_campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ campaigns: campaigns ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name: string
    form_id?: string | null
    form_name?: string | null
    date_from?: string | null
    date_to?: string | null
    template_name?: string | null
    template_language?: string
    message_preview: string
    total_leads?: number
  }

  if (!body.name?.trim() || !body.message_preview?.trim()) {
    return NextResponse.json({ error: 'name and message_preview required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: campaign, error } = await service
    .from('lead_campaigns')
    .insert({
      user_id:           user.id,
      name:              body.name.trim(),
      form_id:           body.form_id ?? null,
      form_name:         body.form_name ?? null,
      date_from:         body.date_from ?? null,
      date_to:           body.date_to ?? null,
      template_name:     body.template_name ?? null,
      template_language: body.template_language ?? 'en',
      message_preview:   body.message_preview.trim(),
      total_leads:       body.total_leads ?? 0,
      status:            'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign })
}

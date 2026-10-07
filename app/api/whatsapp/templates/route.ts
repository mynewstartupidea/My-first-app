import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { STARTER_TEMPLATES, getTemplateStatuses, updateStarterTemplates } from '@/lib/whatsapp-templates'

// updateStarterTemplates now runs every template in parallel (a few seconds
// typically), but a template whose delete is slow to propagate on Meta's
// side can retry for up to ~21s — give this real headroom instead of
// risking Vercel's default timeout killing the request before a response
// is ever sent (that looked like the "Update on Meta" button hanging
// forever with no toast, when actually the function just got cut off).
export const maxDuration = 60

// GET /api/whatsapp/templates
// Returns Wapaci starter templates with their Meta approval status.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('waba_id, access_token')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!wa?.waba_id) {
    return NextResponse.json({
      templates: STARTER_TEMPLATES.map(t => ({ ...t, status: 'whatsapp_not_connected' })),
    })
  }

  const token    = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa.access_token as string
  const statuses = await getTemplateStatuses(wa.waba_id as string, token)

  const templates = STARTER_TEMPLATES.map(t => ({
    ...t,
    status: statuses[t.name] ?? 'PENDING',
  }))

  return NextResponse.json({ templates })
}

// POST /api/whatsapp/templates
// Deletes and re-submits all starter templates with the current body text.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('waba_id, access_token')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!wa?.waba_id) {
    return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })
  }

  const token   = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa.access_token as string
  const results = await updateStarterTemplates(wa.waba_id as string, token)

  return NextResponse.json({ results })
}

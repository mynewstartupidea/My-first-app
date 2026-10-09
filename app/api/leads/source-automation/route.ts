import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'
import { LEAD_SOURCE_AUTOMATIONS, type LeadSourceKind } from '@/lib/lead-source-automation'

const VALID_SOURCES = new Set(Object.keys(LEAD_SOURCE_AUTOMATIONS))

// GET — current config for the two non-Facebook lead-source automations
// (landing page, manual add), keyed by source so the UI can render both
// rows without two separate requests.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ sources: {} })

  const formIds = Object.values(LEAD_SOURCE_AUTOMATIONS).map(s => s.formId)
  const { data: rows } = await service
    .from('lead_form_automations')
    .select('form_id, message_template, is_enabled, wa_template_name, wa_template_language')
    .eq('store_id', store.id)
    .in('form_id', formIds)

  const sources: Record<string, { isEnabled: boolean; messageTemplate: string; waTemplateName: string | null }> = {}
  for (const [key, meta] of Object.entries(LEAD_SOURCE_AUTOMATIONS)) {
    const row = rows?.find(r => r.form_id === meta.formId)
    sources[key] = {
      isEnabled:       row?.is_enabled ?? false,
      messageTemplate: (row?.message_template as string | null) ?? '',
      waTemplateName:  (row?.wa_template_name as string | null) ?? null,
    }
  }
  return NextResponse.json({ sources })
}

// POST — upsert one source's automation.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same tier as every other automation-management action.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'Only the owner, an admin, or a manager can edit automations.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    source?: string; isEnabled?: boolean; messageTemplate?: string
  }
  if (!body.source || !VALID_SOURCES.has(body.source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }
  if (body.isEnabled && !body.messageTemplate?.trim()) {
    return NextResponse.json({ error: 'Write a message template before turning this on.' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  const meta = LEAD_SOURCE_AUTOMATIONS[body.source as LeadSourceKind]
  const { error } = await service.from('lead_form_automations').upsert({
    user_id:           ownerId,
    store_id:          store.id,
    connection_id:     null,
    form_id:           meta.formId,
    form_name:         meta.label,
    message_template:  body.messageTemplate?.trim() ?? '',
    is_enabled:        !!body.isEnabled,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'store_id,form_id' })

  if (error) {
    console.error('[leads/source-automation] upsert error:', error.message)
    return NextResponse.json({ error: "Couldn't save this automation. Please try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// GET/PUT the merchant's AI knowledge base — the only source of truth the
// WhatsApp AI auto-reply is allowed to answer from (lib/ai-reply.ts).
// Owner/admin only: this content controls what AI says to customers
// unsupervised, same trust tier as billing or removing teammates.

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can manage the AI Assistant.' }, { status: 403 })
  }
  return { user }
}

export async function GET() {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (gate instanceof NextResponse) return gate

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, gate.user.id)
  const { data: store } = await service
    .from('stores').select('id, ai_reply_enabled').eq('user_id', ownerId).eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const { data: kb } = await service
    .from('ai_knowledge_base').select('content, updated_at').eq('store_id', store.id).maybeSingle()

  return NextResponse.json({
    content:   kb?.content ?? '',
    updatedAt: kb?.updated_at ?? null,
    enabled:   store.ai_reply_enabled ?? false,
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (gate instanceof NextResponse) return gate

  const body = await request.json().catch(() => ({})) as { content?: string }
  const content = (body.content ?? '').slice(0, 20000) // generous cap — this feeds a system prompt, not a database blob

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, gate.user.id)
  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const { error } = await service.from('ai_knowledge_base').upsert(
    { store_id: store.id, content, updated_at: new Date().toISOString() },
    { onConflict: 'store_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ content })
}

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Turns the WhatsApp AI auto-reply on/off for the merchant's store. Owner/
// admin only — this decides whether AI messages customers unsupervised.
// Refuses to enable it without a knowledge base — the toggle button on Live
// Chat sends the user to /dashboard/ai-assistant on this exact error code.
const MIN_KNOWLEDGE_LENGTH = 20

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can turn AI replies on or off.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { enabled?: boolean }
  const enabled = !!body.enabled

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  if (enabled) {
    const { data: kb } = await service
      .from('ai_knowledge_base').select('content').eq('store_id', store.id).maybeSingle()
    if (!kb?.content || kb.content.trim().length < MIN_KNOWLEDGE_LENGTH) {
      return NextResponse.json({
        error:   'needs_knowledge_base',
        message: 'Please fill in some information about your business first.',
      }, { status: 400 })
    }
  }

  const { error } = await service.from('stores').update({ ai_reply_enabled: enabled }).eq('id', store.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enabled })
}

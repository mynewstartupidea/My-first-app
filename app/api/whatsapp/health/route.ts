export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

interface MetaPhoneNumberFields {
  quality_rating?: string       // GREEN | YELLOW | RED
  messaging_limit_tier?: string // TIER_50 | TIER_250 | TIER_1K | TIER_10K | TIER_100K | UNLIMITED
  account_mode?: string         // LIVE | SANDBOX
  error?: { message: string; code: number }
}

// GET /api/whatsapp/health
// Returns quality_rating, messaging_limit_tier, account_mode for the connected WA account.
// Fetches fresh data from Meta and caches in whatsapp_accounts. Falls back to cached data on error.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token, display_phone_number, quality_rating, messaging_limit_tier, account_mode, status')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!wa || wa.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  // Meta doesn't expose a running balance for a self-serve WABA to check
  // proactively (it bills the merchant's own attached card directly, not a
  // prepaid wallet) — the only real signal is error 131042 on an actual
  // send, which lib/whatsapp.ts maps to a message containing "payment
  // method". Checking the last 24h of real sends means every failed
  // message doesn't need its own manual discovery — this shows up the
  // moment any automated job or reply has actually hit the problem.
  const { data: store } = await service.from('stores').select('id').eq('user_id', ownerId).eq('is_active', true).maybeSingle()
  let billingIssue = false
  if (store) {
    const { data: recentFailure } = await service
      .from('messages')
      .select('id, metadata')
      .eq('store_id', store.id).eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20)
    billingIssue = (recentFailure ?? []).some(m => {
      const details = (m.metadata as Record<string, unknown> | null)?.delivery_error as { details?: string } | undefined
      return details?.details?.toLowerCase().includes('payment method')
    })
  }

  // Fetch fresh health from Meta
  try {
    const url = `https://graph.facebook.com/v21.0/${wa.phone_number_id}?fields=quality_rating,messaging_limit_tier,account_mode&access_token=${wa.access_token}`
    const res  = await fetch(url, { cache: 'no-store' })
    const data = await res.json() as MetaPhoneNumberFields

    if (!data.error && data.quality_rating) {
      const updates = {
        quality_rating:       data.quality_rating,
        messaging_limit_tier: data.messaging_limit_tier ?? wa.messaging_limit_tier ?? 'TIER_1K',
        account_mode:         data.account_mode         ?? wa.account_mode         ?? 'LIVE',
      }
      await service.from('whatsapp_accounts').update(updates).eq('user_id', ownerId)
      return NextResponse.json({
        connected: true,
        display_phone_number: wa.display_phone_number,
        billingIssue,
        ...updates,
      })
    }
  } catch { /* network error — fall through to cached data */ }

  // Return cached data
  return NextResponse.json({
    connected: true,
    display_phone_number:  wa.display_phone_number,
    quality_rating:        wa.quality_rating        ?? 'GREEN',
    messaging_limit_tier:  wa.messaging_limit_tier  ?? 'TIER_1K',
    account_mode:          wa.account_mode          ?? 'LIVE',
    billingIssue,
  })
}

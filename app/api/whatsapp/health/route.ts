export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token, display_phone_number, quality_rating, messaging_limit_tier, account_mode, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!wa || wa.status !== 'connected') {
    return NextResponse.json({ connected: false })
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
      await service.from('whatsapp_accounts').update(updates).eq('user_id', user.id)
      return NextResponse.json({
        connected: true,
        display_phone_number: wa.display_phone_number,
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
  })
}

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Allow Vercel cron (no auth header) OR manual calls with secret
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all due pending jobs (scheduled_at <= now)
  const { data: jobs, error } = await supabase
    .from('automation_jobs')
    .select(`*, stores(shop_name, whatsapp_bsp, whatsapp_api_key)`)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Cron fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0, failed = 0

  // Cache per-user remaining messages to avoid N+1 queries
  const remainingCache: Record<string, number> = {}

  // Cache per-store WhatsApp account data (phone_number_id + token) for Meta sends.
  // Using store_id as key; value is null when no whatsapp_accounts row found.
  const waCache: Record<string, { phone_number_id: string | null; access_token: string | null } | null> = {}

  for (const job of jobs ?? []) {
    // Check usage limits for store owner
    const { data: storeOwnerRow } = await supabase
      .from('stores').select('user_id').eq('id', job.store_id).maybeSingle()
    const ownerId = storeOwnerRow?.user_id

    if (ownerId) {
      if (remainingCache[ownerId] === undefined) {
        const { data: rem } = await supabase.rpc('get_messages_remaining', { p_user_id: ownerId })
        remainingCache[ownerId] = rem ?? 500
      }
      if (remainingCache[ownerId] <= 0) {
        await supabase.from('automation_jobs').update({
          status: 'failed',
          error_message: 'Monthly message limit reached. Upgrade your plan.',
        }).eq('id', job.id)
        failed++
        continue
      }
    }

    // Mark as processing to avoid double-sending
    await supabase
      .from('automation_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', 'pending')

    const store = job.stores as { shop_name: string; whatsapp_bsp: string; whatsapp_api_key: string }

    // For Meta BSP: look up phone_number_id (required by Cloud API) and prefer
    // system user token (permanent) over the stored user token (expires ~60 days).
    let apiKeyOverride: string | undefined = store?.whatsapp_api_key ?? undefined
    let phoneNumberIdOverride: string | undefined = undefined

    if (store?.whatsapp_bsp === 'meta') {
      if (!(job.store_id in waCache)) {
        const { data: wa } = await supabase
          .from('whatsapp_accounts')
          .select('phone_number_id, access_token')
          .eq('store_id', job.store_id)
          .maybeSingle()
        waCache[job.store_id] = wa
      }
      const wa = waCache[job.store_id]
      const systemToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN
      apiKeyOverride        = systemToken ?? wa?.access_token ?? undefined
      phoneNumberIdOverride = wa?.phone_number_id ?? undefined
    }

    const result = await sendWhatsAppMessage({
      to:            job.customer_phone,
      message:       job.message,
      bsp:           store?.whatsapp_bsp,
      apiKey:        apiKeyOverride,
      phoneNumberId: phoneNumberIdOverride,
    })

    const now = new Date().toISOString()

    if (result.success) {
      await supabase
        .from('automation_jobs')
        .update({ status: 'sent', sent_at: now })
        .eq('id', job.id)

      await supabase.from('messages').insert({
        store_id:       job.store_id,
        job_id:         job.id,
        customer_phone: job.customer_phone,
        customer_name:  job.customer_name,
        type:           job.type,
        message:        job.message,
        status:         'sent',
        bsp_message_id: result.messageId ?? null,
        metadata:       job.context ?? {},
      })

      // Increment analytics
      const today = now.split('T')[0]
      const { error: rpcErr } = await supabase.rpc('increment_analytics', {
        p_store_id: job.store_id,
        p_date:     today,
        p_field:    'messages_sent',
      })
      if (rpcErr) {
        await supabase.from('analytics_daily').upsert(
          { store_id: job.store_id, date: today, messages_sent: 1 },
          { onConflict: 'store_id,date' }
        )
      }

      // Increment billing usage for store owner
      if (ownerId) {
        await supabase.rpc('increment_messages_used', { p_user_id: ownerId }).then(null, () => null)
        if (remainingCache[ownerId] !== undefined) remainingCache[ownerId]--
      }

      sent++
    } else {
      const retryCount = (job.retry_count ?? 0) + 1
      const permanentlyFailed = retryCount >= 3
      await supabase
        .from('automation_jobs')
        .update({
          status:        permanentlyFailed ? 'failed' : 'pending',
          retry_count:   retryCount,
          error_message: result.error ?? 'Unknown error',
          scheduled_at:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', job.id)

      if (permanentlyFailed) {
        await supabase.from('messages').insert({
          store_id:       job.store_id,
          job_id:         job.id,
          customer_phone: job.customer_phone,
          customer_name:  job.customer_name,
          type:           job.type,
          message:        job.message,
          status:         'failed',
          bsp_message_id: null,
          metadata:       { ...(job.context ?? {}), error: result.error ?? 'Unknown error' },
        })
      }

      failed++
    }
  }

  return NextResponse.json({
    processed: (jobs ?? []).length,
    sent,
    failed,
    timestamp: new Date().toISOString(),
  })
}

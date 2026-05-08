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

  for (const job of jobs ?? []) {
    // Mark as processing to avoid double-sending
    await supabase
      .from('automation_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', 'pending')

    const store = job.stores as { shop_name: string; whatsapp_bsp: string; whatsapp_api_key: string }

    const result = await sendWhatsAppMessage({
      to:      job.customer_phone,
      message: job.message,
      bsp:     store?.whatsapp_bsp,
      apiKey:  store?.whatsapp_api_key,
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
      await supabase.rpc('increment_analytics', {
        p_store_id: job.store_id,
        p_date:     today,
        p_field:    'messages_sent',
      }).catch(() => {
        // Fallback: upsert analytics row manually
        supabase.from('analytics_daily').upsert(
          { store_id: job.store_id, date: today, messages_sent: 1 },
          { onConflict: 'store_id,date', ignoreDuplicates: false }
        )
      })

      sent++
    } else {
      const retryCount = (job.retry_count ?? 0) + 1
      await supabase
        .from('automation_jobs')
        .update({
          status:        retryCount >= 3 ? 'failed' : 'pending',
          retry_count:   retryCount,
          error_message: result.error ?? 'Unknown error',
          scheduled_at:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', job.id)

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

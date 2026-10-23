import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // A job claimed into 'processing' had no reclaim at all — if the function
  // was hard-killed mid-send (Vercel's 60s ceiling firing while
  // sendWhatsAppMessage's network call was in flight, an OOM) rather than
  // throwing a catchable JS error, the row stayed 'processing' forever:
  // invisible to the main query below (which only looks at 'pending'), so
  // that lead/customer silently never got messaged with no retry and no
  // error surfaced anywhere. Same fix already applied to shopify_sync_jobs
  // earlier today. 10 minutes is generous enough to never reclaim a job
  // that's still genuinely mid-send.
  const stuckJobCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await supabase.from('automation_jobs').update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'processing').lt('updated_at', stuckJobCutoff)

  // ── Follow-up due notifications ──────────────────────────────────────────
  // Send one notification per user who has overdue/due-today follow-up leads.
  // Deduped: only one notification per user per calendar day.
  const today = new Date().toISOString().split('T')[0]
  const { data: dueLeads } = await supabase
    .from('leads')
    .select('id, name, user_id, assigned_to')
    .not('followup_at', 'is', null)
    .lte('followup_at', new Date().toISOString())
    .not('lead_status', 'in', '("converted","lost","junk")')

  // Notify the assigned salesperson if set; fall back to the lead owner.
  // This ensures team members get their own follow-up reminders, not the owner.
  const dueCounts: Record<string, number> = {}
  for (const lead of dueLeads ?? []) {
    const notifyUserId = lead.assigned_to ?? lead.user_id
    dueCounts[notifyUserId] = (dueCounts[notifyUserId] ?? 0) + 1
  }

  for (const [userId, count] of Object.entries(dueCounts)) {
    const { count: alreadySent } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'followup_due')
      .gte('created_at', `${today}T00:00:00.000Z`)
    if (!alreadySent) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type:    'followup_due',
        title:   `📞 ${count} follow-up${count !== 1 ? 's' : ''} due today`,
        body:    'Some of your leads are waiting for a call. Check your follow-ups.',
        link:    '/dashboard/leads?sort=followup_due',
        is_read: false,
      })
    }
  }

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

  // Cache per-store WhatsApp account data (phone_number_id + token) for Meta sends.
  // Using store_id as key; value is null when no whatsapp_accounts row found.
  const waCache: Record<string, { phone_number_id: string | null; access_token: string | null } | null> = {}

  for (const job of jobs ?? []) {
    const { data: storeOwnerRow } = await supabase
      .from('stores').select('user_id').eq('id', job.store_id).maybeSingle()
    const ownerId = storeOwnerRow?.user_id

    // Atomically claim this job — only one cron run can win the update.
    // If the row was already claimed by a concurrent run, data will be empty; skip it.
    const { data: claimed } = await supabase
      .from('automation_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')

    if (!claimed || claimed.length === 0) continue

    // Stuck-'processing' reclaim (below, this file) can't tell "crashed
    // before the send happened" from "the Meta API call actually
    // succeeded, but the function was hard-killed before the status:'sent'
    // write landed" — updated_at is stamped at claim time, before the send
    // round-trip, so a kill in that narrow gap leaves the job reclaimable
    // and it would otherwise get resent on a later tick: a second, real
    // message hitting the customer's phone. A `messages` row only ever
    // gets written right after a real send attempt resolves (success or
    // permanent failure, both insert one), so its existence for this
    // job_id is reliable proof this job already ran once.
    const { data: alreadySent } = await supabase
      .from('messages').select('id').eq('job_id', job.id).limit(1).maybeSingle()
    if (alreadySent) {
      await supabase.from('automation_jobs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', job.id)
      continue
    }

    // Quota check used to read get_messages_remaining once per invocation
    // and decrement a local in-memory cache as jobs sent — this and
    // app/api/cron/campaign-send (bulk campaigns) are two independent
    // crons that can run in overlapping windows for the same owner; both
    // working off their own stale local count meant they could each send
    // up to the full remaining amount, double-spending the real quota.
    // try_increment_messages_used (supabase/migrations.sql) checks and
    // increments atomically, so this is the actual gate now, evaluated
    // fresh per message rather than cached per invocation.
    // Fails closed, not open — an orphaned job (store row deleted/missing,
    // a race with store deletion) used to leave ownerId undefined and skip
    // the RPC entirely while quotaOk's initial default stayed true, sending
    // the message with the billing/quota gate completely bypassed. A
    // billing-relevant gate should never default to "allowed."
    let quotaOk = false
    if (ownerId) {
      const { data: allowed } = await supabase.rpc('try_increment_messages_used', { p_user_id: ownerId })
      quotaOk = !!allowed
    }
    if (!quotaOk) {
      // This used to mark the job permanently 'failed' on the very first
      // quota hit — but unlike every other failure path in this file (the
      // Meta-error branch below), nothing anywhere ever reads back a
      // 'failed' job to retry it. A quota limit is routinely a same-day,
      // temporary condition (merchant sees the notification below and
      // upgrades, or the monthly reset lands) — a customer whose message
      // was queued during that window would otherwise just never receive
      // it, permanently, with no error visible anywhere beyond a DB column
      // no UI reads. Requeue it instead, same retry_count field the normal
      // failure path already uses, at a 1-hour interval (quota resolution
      // is an hours/days-scale event, not the 5-minute transient-API-error
      // scale the other retry path is tuned for) for up to 48 attempts
      // (~2 days) before finally giving up — matching the existing
      // "bounded retries, then permanently failed" shape used elsewhere in
      // this file rather than retrying forever.
      const quotaRetryCount = (job.retry_count ?? 0) + 1
      const quotaPermanentlyFailed = quotaRetryCount >= 48
      await supabase.from('automation_jobs').update({
        status:        quotaPermanentlyFailed ? 'failed' : 'pending',
        retry_count:   quotaRetryCount,
        error_message: 'Monthly message limit reached.',
        ...(quotaPermanentlyFailed ? {} : { scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
      }).eq('id', job.id)
      failed++

      // automation_jobs.error_message has no UI anywhere that reads it — a
      // merchant whose automation silently stopped sending had zero way to
      // find out why. Surface it as a notification instead, deduped to once
      // per owner per day so every subsequent blocked job this tick (and
      // every tick after, until the plan is upgraded) doesn't queue a
      // duplicate.
      if (ownerId) {
        const today = new Date().toISOString().split('T')[0]
        const { count: alreadyNotified } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', ownerId)
          .eq('type', 'quota_reached')
          .gte('created_at', `${today}T00:00:00.000Z`)
        if (!alreadyNotified) {
          await supabase.from('notifications').insert({
            user_id: ownerId,
            type:    'quota_reached',
            title:   '⚠️ Monthly message limit reached',
            body:    "Your WhatsApp automations have paused because you hit your plan's monthly message limit. Upgrade your plan to keep sending.",
            link:    '/dashboard/settings?tab=billing',
            is_read: false,
          })
        }
      }
      continue
    }

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

    const ctx = (job.context as Record<string, unknown> | null) ?? {}

    // whatsapp_bsp defaults to 'mock' for every newly-created store
    // (supabase/schema.sql) and nothing in any job-creation path (Shopify
    // webhooks, Facebook lead ingestion, etc.) checks whether WhatsApp is
    // actually connected before queuing a job — a merchant with Shopify
    // live but WhatsApp not set up yet had every automation job silently
    // hit sendWhatsAppMessage's 'mock' branch, which returns success after
    // only a console.log. Jobs got marked 'sent', a messages row said
    // 'sent', quota got spent — while zero real messages ever went out,
    // and the merchant's dashboard showed everything working. Real
    // providers only; 'mock' is for local dev, never a live job.
    const result = store?.whatsapp_bsp && store.whatsapp_bsp !== 'mock'
      ? await sendWhatsAppMessage({
          to:               job.customer_phone,
          message:          job.message,
          bsp:              store.whatsapp_bsp,
          apiKey:           apiKeyOverride,
          phoneNumberId:    phoneNumberIdOverride,
          templateName:     (ctx.wa_template_name as string | undefined) || undefined,
          templateLanguage: (ctx.wa_template_language as string | undefined) || undefined,
          templateParams:   (ctx.wa_template_params as string[] | undefined) || undefined,
        })
      : { success: false, error: 'WhatsApp is not connected for this store yet.' }

    const now = new Date().toISOString()

    if (result.success) {
      await supabase
        .from('automation_jobs')
        .update({ status: 'sent', sent_at: now })
        .eq('id', job.id)

      // lead_ad jobs set leads.wa_status = 'pending' the moment they're
      // queued, but nothing ever advanced it from there — every Facebook/
      // landing-page/manual lead stayed stuck showing "Queued" in the Leads
      // table forever, even long after the message actually sent (and the
      // lead replied). Every type other than lead_ad has no lead_id in
      // context and never touches the leads table at all, so this is a
      // no-op for them.
      const leadId = ctx.lead_id as string | undefined
      if (leadId) {
        await supabase.from('leads').update({ wa_status: 'sent' }).eq('id', leadId)
      }

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

      // Quota was already spent atomically above, before the send was even
      // attempted — nothing left to do here.
      sent++
    } else {
      // That quota unit was spent before we knew the send would fail —
      // refund it so a failed send doesn't cost real quota. This job will
      // likely retry below anyway (and re-spend one unit on the retry),
      // but a permanently-failed job shouldn't have silently cost quota
      // for a message that was never delivered.
      if (ownerId) {
        await supabase.rpc('decrement_messages_used', { p_user_id: ownerId }).then(null, () => null)
      }

      // lib/whatsapp.ts's own error messages literally say "— will retry"
      // for WhatsApp rate-limit (130429) and transient service (131000)
      // errors — app/api/cron/campaign-send already keys off that same
      // text to decide whether to retry. This cron (which processes every
      // Shopify/lead_ad one-off send) didn't: it retried EVERY failure up
      // to 3 times, including permanent ones like "not registered on
      // WhatsApp" or a missing/unapproved template, wasting quota-spend/
      // refund cycles and delaying the merchant seeing an unrecoverable
      // reason by up to 15 minutes (3 × 5-minute delay) for something a
      // retry could never fix.
      const isRetryable = /will retry/i.test(result.error ?? '')
      const retryCount = (job.retry_count ?? 0) + 1
      const permanentlyFailed = !isRetryable || retryCount >= 3
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

        const leadId = ctx.lead_id as string | undefined
        if (leadId) {
          await supabase.from('leads').update({ wa_status: 'failed' }).eq('id', leadId)
        }
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

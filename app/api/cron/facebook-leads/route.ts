import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'
import { assignRoundRobin } from '@/lib/lead-assignment'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Sync ALL tracked forms regardless of is_enabled.
  // Lead syncing is independent of WhatsApp automation — a form added to
  // lead_form_automations always gets its leads pulled; WhatsApp jobs are
  // only created when is_enabled = true.
  const { data: forms } = await supabase
    .from('lead_form_automations')
    .select('id, user_id, store_id, connection_id, form_id, form_name, message_template, is_enabled, last_lead_fetch, wa_template_name, wa_template_language')

  let synced = 0

  for (const form of forms ?? []) {
    const { data: conn } = await supabase
      .from('facebook_connections')
      .select('page_id, page_access_token, user_access_token')
      .eq('id', form.connection_id)
      .maybeSingle()

    if (!conn) continue

    const token = (conn.user_access_token as string | null) ?? conn.page_access_token as string
    const since = form.last_lead_fetch as string | null

    const { leads: fbLeads, ok: fetchOk, accessLost } = await getFormLeads(form.form_id as string, token, since)
    if (!fetchOk) {
      // Fetch actually failed — do NOT advance last_lead_fetch, or any lead
      // submitted during this outage is lost forever (the next run only
      // looks for leads created after the watermark).
      console.error(`[cron/facebook-leads] getFormLeads failed for form ${form.form_id}, leaving last_lead_fetch untouched`)

      // This cron has no UI of its own — without surfacing this somewhere a
      // merchant would actually look, a dead page token meant every lead
      // submitted on that page silently vanished (never synced, never
      // messaged) with nothing anywhere to tell the merchant why. Same
      // code-190 "access lost" detection as lib/facebook.ts / lib/facebook-sync.ts;
      // deduped to once per connection per day so a 5-minute cron tick
      // doesn't spam a notification every run while the page stays disconnected.
      if (accessLost) {
        const today = new Date().toISOString().split('T')[0]
        const { count: alreadyNotified } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', form.user_id)
          .eq('type', 'fb_access_lost')
          .eq('link', `/dashboard/leads?page_id=${conn.page_id}`)
          .gte('created_at', `${today}T00:00:00.000Z`)
        if (!alreadyNotified) {
          await supabase.from('notifications').insert({
            user_id: form.user_id,
            type:    'fb_access_lost',
            title:   '⚠️ Facebook page access lost',
            body:    `You no longer have access to "${form.form_name}" — please reconnect it from Integrations.`,
            link:    `/dashboard/leads?page_id=${conn.page_id}`,
            is_read: false,
          })
        }
      }
      continue
    }
    if (!fbLeads.length) {
      // Still update last_lead_fetch so next run uses a fresh window
      await supabase
        .from('lead_form_automations')
        .update({ last_lead_fetch: new Date().toISOString() })
        .eq('id', form.id)
      continue
    }

    const parsed = fbLeads.map(fl => {
      const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
      const fields = extractAllFields(fl.field_data ?? [])
      return { fl, name, email, phone, fields }
    })

    const rows = parsed.map(({ fl, name, email, phone, fields }) => ({
      user_id:          form.user_id,
      store_id:         form.store_id,
      facebook_lead_id: fl.id,
      page_id:          conn.page_id,
      form_id:          form.form_id,
      form_name:        form.form_name,
      name, email, phone, fields,
      raw_data:   { field_data: fl.field_data },
      // Was 'pending' unconditionally — every other lead-ingestion path in
      // this codebase (the real-time webhook, lib/facebook-sync.ts, manual/
      // bulk-import/ingest routes) sets 'imported' here and only upgrades to
      // 'pending' once an automation_jobs row is actually created below. A
      // lead synced for a form whose automation is disabled (is_enabled =
      // false, e.g. the merchant is still drafting the message) got marked
      // 'pending' here with no job ever queued — permanently excluded from
      // bulk-message (which only targets 'imported'/'failed') and showing
      // "Resend WhatsApp" in the UI for a message that was never sent.
      wa_status:  phone ? 'imported' : 'no_phone',
      created_at: fl.created_time,
    }))

    const { data: savedRows } = await supabase.from('leads')
      .upsert(rows, { onConflict: 'user_id,facebook_lead_id', ignoreDuplicates: true })
      .select('id, phone, name, fields')

    synced += fbLeads.length

    // This is the main lead-ingestion path in production (runs every 5
    // minutes per vercel.json) — round-robin assignment used to live only
    // in lib/facebook-sync.ts's manual "Sync Now" path, so an org with
    // round-robin distribution enabled saw every real lead land unassigned.
    await assignRoundRobin(supabase, form.user_id as string, (savedRows ?? []).map(s => s.id as string))

    // Only queue WhatsApp jobs when automation is enabled for this form
    if (form.is_enabled && savedRows?.length && form.message_template) {
      // This periodic polling sync's select() never carried wa_template_name/
      // wa_template_language (unlike the real-time webhook path in
      // lib/facebook-sync.ts, which this mirrors), so a job queued through
      // THIS path for an automation configured to use an approved Meta
      // template was sent as free-form text instead — which Meta rejects
      // outside the 24h customer-service window, exactly the case for a
      // brand-new lead who hasn't messaged the business first.
      const waTemplateName = (form.wa_template_name as string | null) || null
      const waTemplateLang = (form.wa_template_language as string | null) || 'en'
      const jobs = savedRows
        .filter(s => s.phone)
        .map(s => {
          const fields = (s.fields as Record<string, string>) ?? {}
          const vars = { ...fields, name: s.name ?? 'there', email: fields.email ?? '', phone: s.phone as string }
          const message = renderTemplate(form.message_template as string, vars)
          const waParams = waTemplateName ? extractTemplateParams(form.message_template as string, vars) : undefined
          return {
            store_id:       form.store_id,
            automation_id:  null,
            type:           'lead_ad',
            customer_phone: s.phone,
            customer_name:  s.name ?? 'Lead',
            message,
            context: {
              lead_id: s.id, form_id: form.form_id,
              ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
            },
            status:         'pending',
            scheduled_at:   new Date().toISOString(),
          }
        })
      if (jobs.length) {
        const { error: insertErr } = await supabase.from('automation_jobs').insert(jobs)
        if (insertErr) {
          console.error('[cron/facebook-leads] automation_jobs insert failed:', insertErr.message)
        } else {
          await supabase.from('leads').update({ wa_status: 'pending' })
            .in('id', savedRows.filter(s => s.phone).map(s => s.id))
        }
      }
    }

    await supabase
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  return NextResponse.json({ synced, timestamp: new Date().toISOString() })
}

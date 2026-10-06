// Shared historical Lead Ads sync — pulls existing leads for a page's forms
// from the Graph API. Used by both the manual "Refresh" button and the
// page-picker confirm step (so a freshly connected page isn't left showing
// "No leads yet" until the next manual refresh or cron run).

import { createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, getLeadForms, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'

type ServiceClient = ReturnType<typeof createServiceClient>

export async function syncFacebookPageLeads(
  service: ServiceClient,
  ownerId: string,
  pageId: string,
): Promise<{ synced: number; newLeads: number; error?: string }> {
  // All connections for this user on this page (handles multiple reconnects)
  const { data: pageConns } = await service
    .from('facebook_connections')
    .select('id, page_id, page_access_token, user_access_token, store_id')
    .eq('user_id', ownerId)
    .eq('page_id', pageId)

  if (!pageConns?.length) return { synced: 0, newLeads: 0 }

  const liveConn = pageConns[0]
  const liveConnId = liveConn.id as string
  const liveToken = (liveConn.user_access_token as string | null) ?? liveConn.page_access_token as string

  // Check once whether WhatsApp is connected — jobs are only created if it is
  const { data: waConn } = await service
    .from('whatsapp_accounts')
    .select('id')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()
  const whatsappConnected = !!waConn

  // All connection IDs that currently exist for this user — used to map connection_id → page_id
  const { data: allConns } = await service
    .from('facebook_connections')
    .select('id, page_id')
    .eq('user_id', ownerId)

  const connPageMap: Record<string, string> = {}
  for (const c of allConns ?? []) connPageMap[c.id as string] = c.page_id as string

  // All form automations for this user
  const { data: allForms } = await service
    .from('lead_form_automations')
    .select('id, form_id, form_name, connection_id, message_template, is_enabled, last_lead_fetch, store_id, wa_template_name, wa_template_language')
    .eq('user_id', ownerId)

  // Filter to forms on this page — works even with stale connection_ids
  let forms = (allForms ?? []).filter(f => connPageMap[f.connection_id as string] === pageId)

  // Heal stale connection_ids: update any form still pointing at an old connection
  const stale = forms.filter(f => f.connection_id !== liveConnId)
  if (stale.length) {
    await service
      .from('lead_form_automations')
      .update({ connection_id: liveConnId })
      .in('id', stale.map(f => f.id))
  }

  // If no forms found at all, fetch from Facebook and register them now
  if (!forms.length) {
    const fbForms = await getLeadForms(pageId, liveConn.page_access_token as string, liveToken)
    if (fbForms.length) {
      const { data: existingForms } = await service
        .from('lead_form_automations')
        .select('form_id')
        .eq('user_id', ownerId)
      const existingIds = new Set((existingForms ?? []).map(f => f.form_id as string))

      const newRows = fbForms
        .filter(f => !existingIds.has(f.id))
        .map(f => ({
          user_id:          ownerId,
          store_id:         liveConn.store_id ?? null,
          connection_id:    liveConnId,
          form_id:          f.id,
          form_name:        f.name,
          message_template: '',
          is_enabled:       false,
          updated_at:       new Date().toISOString(),
        }))

      if (newRows.length) {
        await service.from('lead_form_automations').insert(newRows)
      }

      const { data: allAfterInsert } = await service
        .from('lead_form_automations')
        .select('id, form_id, form_name, connection_id, message_template, is_enabled, last_lead_fetch, store_id, wa_template_name, wa_template_language')
        .eq('user_id', ownerId)

      forms = (allAfterInsert ?? []).filter(f => connPageMap[f.connection_id as string] === pageId)
    }
  }

  if (!forms.length) return { synced: 0, newLeads: 0 }

  // ── Round-robin distribution setup ─────────────────────────────────────────
  // rr_current_pos itself is now read-and-advanced atomically per batch via
  // advance_round_robin_position (see below) — no local position tracking
  // needed here anymore.
  let rrMembersWithEmail: Array<{ user_id: string; email: string }> = []
  let orgId: string | null = null

  const { data: orgRow } = await service
    .from('organizations')
    .select('id, lead_distribution_mode, distribution_members')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (orgRow?.lead_distribution_mode === 'round_robin') {
    const distMembers = (orgRow.distribution_members ?? []) as Array<{ user_id: string }>
    orgId = orgRow.id as string

    if (distMembers.length > 0) {
      const { data: tmRows } = await service
        .from('team_members')
        .select('user_id, email')
        .eq('organization_id', orgRow.id)
        .eq('status', 'active')
        .in('user_id', distMembers.map(m => m.user_id))

      rrMembersWithEmail = distMembers
        .map(m => {
          const tm = tmRows?.find(t => t.user_id === m.user_id)
          return tm ? { user_id: m.user_id!, email: tm.email as string } : null
        })
        .filter(Boolean) as Array<{ user_id: string; email: string }>
    }
  }

  let synced     = 0
  let newLeads   = 0
  let accessLost = false

  for (const form of forms) {
    const since = form.last_lead_fetch as string | null

    const { leads: fbLeads, ok: fetchOk, accessLost: thisFormAccessLost } = await getFormLeads(form.form_id as string, liveToken, since)
    if (!fetchOk) {
      // Fetch actually failed (expired token, rate limit, transient 5xx) —
      // do NOT advance last_lead_fetch, or every lead submitted during this
      // outage is lost forever once the next successful sync only looks
      // for leads created after the watermark.
      console.error(`[facebook-sync] getFormLeads failed for form ${form.form_id}, leaving last_lead_fetch untouched`)
      // code 190 (OAuthException) specifically means the token/connection
      // itself is dead, not a one-off blip — every other form on this same
      // page shares the same token, so one hit is enough to know the whole
      // page has lost access. Previously this fell straight through to the
      // generic "{ synced: 0 }" result below, which the UI shows as
      // "Already up to date" — actively telling someone their connection
      // is fine when it's actually broken and needs reconnecting.
      if (thisFormAccessLost) accessLost = true
      continue
    }
    if (!fbLeads.length) {
      await service
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
      user_id:          ownerId,
      store_id:         form.store_id,
      facebook_lead_id: fl.id,
      page_id:          pageId,
      form_id:          form.form_id,
      form_name:        form.form_name,
      name, email, phone, fields,
      raw_data:      { field_data: fl.field_data },
      wa_status:     phone ? 'imported' : 'no_phone',
      created_at:    fl.created_time,
      ad_name:       fl.ad_name       ?? null,
      adset_name:    fl.adset_name    ?? null,
      campaign_name: fl.campaign_name ?? null,
    }))

    const { data: saved } = await service.from('leads')
      .upsert(rows, { onConflict: 'user_id,facebook_lead_id', ignoreDuplicates: true })
      .select('id, phone, name, form_id, fields')

    synced += fbLeads.length

    // ── Round-robin auto-assign newly imported leads ────────────────────────
    // advance_round_robin_position atomically reads+advances rr_current_pos
    // and returns the position to start THIS batch from — see the migration
    // comment for why the old read-once/advance-locally/write-once-at-end
    // pattern was a race under concurrent syncs for the same org.
    if (rrMembersWithEmail.length > 0 && saved?.length && orgId) {
      const { data: batchStartPos } = await service.rpc('advance_round_robin_position', {
        p_org_id: orgId, p_count: saved.length, p_member_count: rrMembersWithEmail.length,
      })
      const startPos = batchStartPos ?? 0
      for (let idx = 0; idx < saved.length; idx++) {
        const member = rrMembersWithEmail[(startPos + idx) % rrMembersWithEmail.length]
        await service.from('leads')
          .update({ assigned_to: member.user_id, assigned_name: member.email })
          .eq('id', saved[idx].id)
          .is('assigned_to', null)
      }
    }

    // Only queue WhatsApp jobs when automation is enabled AND WhatsApp is connected
    if (whatsappConnected && form.is_enabled && saved?.length && form.message_template) {
      const waTemplateName = (form.wa_template_name as string | null) || null
      const waTemplateLang = (form.wa_template_language as string | null) || 'en'
      const jobs = saved
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
              lead_id: s.id, form_id: form.form_id, source: 'manual_sync',
              ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
            },
            status:         'pending',
            scheduled_at:   new Date().toISOString(),
          }
        })
      if (jobs.length) {
        // The insert error was previously discarded (.then(null, () => null))
        // and leads were marked wa_status:'pending' regardless of whether it
        // actually succeeded — if the insert failed, those leads looked
        // "queued" forever in the dashboard with no job ever created and no
        // way to tell. Only mark the ones that actually got a job.
        const { error: insertErr } = await service.from('automation_jobs').insert(jobs)
        if (insertErr) {
          console.error('[facebook-sync] automation_jobs insert failed:', insertErr.message)
        } else {
          const queuedIds = saved.filter(s => s.phone).map(s => s.id)
          await service.from('leads').update({ wa_status: 'pending' }).in('id', queuedIds)
          newLeads += jobs.length
        }
      }
    }

    await service
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  if (accessLost) {
    return {
      synced, newLeads,
      error: 'You no longer have access to this Facebook page — please reconnect it from Integrations.',
    }
  }

  return { synced, newLeads }
}

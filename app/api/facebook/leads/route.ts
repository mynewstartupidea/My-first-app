import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { STARTER_TEMPLATES } from '@/lib/whatsapp-templates'

// GET /api/facebook/leads?form_id=xxx&page_id=xxx&limit=50&offset=0&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&sort=followup_due
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId   = searchParams.get('form_id')
  const pageId   = searchParams.get('page_id')
  const fromDate = searchParams.get('from_date')
  const toDate   = searchParams.get('to_date')
  const download = searchParams.get('download') === 'true'
  const limit    = download ? 5000 : Math.min(parseInt(searchParams.get('limit') ?? '50') || 50, 200)
  const offset   = parseInt(searchParams.get('offset') ?? '0') || 0
  const q           = searchParams.get('q')?.trim() ?? ''
  const leadStatus  = searchParams.get('lead_status')
  const sort        = searchParams.get('sort') // 'followup_due' sorts overdue+today first
  // Non-Facebook sources (walk_in, referral, channel_partner, landing_page,
  // manual) have no page_id/form_id — filtering by source instead of page
  // scoping is how they surface at all, since selectedPageId is otherwise
  // always set once any Facebook page is connected.
  const source      = searchParams.get('source')
  // Used only by the dashboard and Leads page's "no Facebook page connected"
  // states. Without it, calling this route with none of source/form_id/
  // page_id applies NO filter at all beyond ownership — it returns every
  // lead the account has ever had, including ones tied to a page that was
  // later disconnected. That's wrong for "nothing is connected right now":
  // this scopes to leads that never had a Facebook page at all (manual, CSV
  // import, website-form ingest), not stale leads from a defunct connection.
  const noPage      = searchParams.get('no_page') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Resolve org context: check if user is a team member to get org owner + distribution mode
  let orgOwnerId: string | null = null
  let distMode = 'manual'
  const { data: memberRow } = await service
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (memberRow?.organization_id) {
    const { data: org } = await service
      .from('organizations')
      .select('owner_id, lead_distribution_mode')
      .eq('id', memberRow.organization_id)
      .maybeSingle()
    if (org) {
      orgOwnerId = org.owner_id
      distMode   = org.lead_distribution_mode ?? 'manual'
    }
  }

  // leads.user_id always holds the ORG OWNER's auth id (same convention as
  // whatsapp_accounts, facebook_connections, lead_form_automations) — a team
  // member's own user.id never matches it. Using user.id directly here made
  // every non-open_pool team member's filter collapse to "assigned_to.eq"
  // only, so admins/managers saw just their own explicitly-assigned leads
  // instead of the whole org's, with no "All leads" tab actually showing all.
  const ownerId = orgOwnerId ?? user.id

  const buildQuery = (countOnly = false) => {
    // In open_pool mode, a team member sees only their own assigned leads
    // plus unclaimed pool leads — NOT a blanket "all org leads" match, since
    // that's the whole point of that distribution mode.
    const visibilityFilter = (orgOwnerId && distMode === 'open_pool')
      ? `assigned_to.eq.${user.id},and(user_id.eq.${ownerId},assigned_to.is.null)`
      : `user_id.eq.${ownerId},assigned_to.eq.${user.id}`

    let query = service
      .from('leads')
      .select('id,name,email,phone,form_id,form_name,page_id,wa_status,lead_status,assigned_to,assigned_name,followup_at,created_at,fields,ad_name,adset_name,campaign_name,source', countOnly ? { count: 'exact', head: true } : { count: 'exact' })
      .or(visibilityFilter)

    if (sort === 'followup_due') {
      // Overdue + today only (for dashboard widget and badge count)
      query = query
        .not('followup_at', 'is', null)
        .lte('followup_at', new Date().toISOString())
        .order('followup_at', { ascending: true })
    } else if (sort === 'followup_all') {
      // All leads that have any follow-up date, sorted chronologically
      // (past first, then future) — used by the Follow-ups tab view
      query = query
        .not('followup_at', 'is', null)
        .order('followup_at', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    if (source) {
      // Orthogonal to page/form scoping — bypasses it entirely, since these
      // leads never have a page_id/form_id to filter by.
      query = query.eq('source', source)
    } else if (formId) {
      query = query.eq('form_id', formId)
    } else if (pageId) {
      query = query.eq('page_id', pageId)
    } else if (noPage) {
      query = query.is('page_id', null).is('form_id', null)
    }
    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00.000Z`)
    if (toDate)   query = query.lte('created_at', `${toDate}T23:59:59.999Z`)
    if (q) {
      const esc = q.replace(/[%_\\]/g, '\\$&')
      query = query.or(`name.ilike.%${esc}%,phone.ilike.%${esc}%,email.ilike.%${esc}%`)
    }
    if (leadStatus) query = query.eq('lead_status', leadStatus)
    return query
  }

  const { data: leads, count } = await buildQuery().range(offset, offset + limit - 1)

  const total = count ?? 0
  return NextResponse.json({
    leads: leads ?? [],
    total,
    hasMore: offset + limit < total,
  })
}

// POST /api/facebook/leads — manually send WhatsApp to a specific lead
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, message, waTemplateName, waTemplateLanguage } = await request.json() as {
    leadId: string; message: string; waTemplateName?: string; waTemplateLanguage?: string
  }
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: lead } = await service
    .from('leads').select('*').eq('id', leadId)
    .or(`user_id.eq.${ownerId},assigned_to.eq.${user.id}`).maybeSingle()

  if (!lead?.phone) return NextResponse.json({ error: 'Lead not found or has no phone' }, { status: 400 })
  if (!lead.store_id) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const vars = {
    ...(lead.fields as Record<string, string> ?? {}),
    name: lead.name ?? 'there',
    email: lead.email ?? '',
    phone: lead.phone,
  }

  // Explicit template pick (from SendTemplateModal, app/dashboard/leads/page.tsx)
  // — used when there's no form automation to fall back to, e.g. a manually
  // added/CSV-imported/walk-in lead that was never tied to a Facebook form.
  if (waTemplateName) {
    const starter = STARTER_TEMPLATES.find(t => t.name === waTemplateName)
    if (!starter) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })

    await service.from('automation_jobs').insert({
      store_id: lead.store_id, automation_id: null,
      type: 'lead_ad', customer_phone: lead.phone, customer_name: lead.name ?? 'Lead',
      message: renderTemplate(starter.bodyPreview, vars),
      context: {
        lead_id: leadId, form_id: lead.form_id, manual: true,
        wa_template_name: starter.name,
        wa_template_language: waTemplateLanguage || starter.language,
        wa_template_params: extractTemplateParams(starter.bodyPreview, vars),
      },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
    await service.from('leads').update({ wa_status: 'pending' }).eq('id', leadId)
    return NextResponse.json({ ok: true })
  }

  // Render template with lead fields if the caller didn't already do it
  // Look up template by the lead owner's user_id — team members don't own the automation
  const { data: auto } = await service
    .from('lead_form_automations')
    .select('message_template')
    .eq('form_id', lead.form_id)
    .eq('user_id', lead.user_id)
    .maybeSingle()

  const finalMessage = auto?.message_template ? renderTemplate(auto.message_template, vars) : message

  if (!finalMessage.trim()) {
    // code: 'no_template' lets the caller (app/dashboard/leads/page.tsx)
    // distinguish this specific, recoverable case — no automation matched —
    // from a real failure, and offer the SendTemplateModal picker instead of
    // just surfacing an error.
    return NextResponse.json({
      error: 'No message template found for this form. Edit the form template first.',
      code: 'no_template',
    }, { status: 400 })
  }

  await service.from('automation_jobs').insert({
    store_id: lead.store_id, automation_id: null,
    type: 'lead_ad', customer_phone: lead.phone, customer_name: lead.name ?? 'Lead',
    message: finalMessage,
    context: { lead_id: leadId, form_id: lead.form_id, manual: true },
    status: 'pending', scheduled_at: new Date().toISOString(),
  })

  await service.from('leads').update({ wa_status: 'pending' }).eq('id', leadId)

  return NextResponse.json({ ok: true })
}

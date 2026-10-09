import { createServiceClient } from '@/lib/supabase/server'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'

type ServiceClient = ReturnType<typeof createServiceClient>

// "Lead Ad Response" only ever fired for leads that came through an
// activated Facebook Lead Ad form — a lead captured through the website-
// form ingest endpoint, or added by hand, had no equivalent way to get an
// instant WhatsApp greeting, and no UI anywhere let a merchant configure
// one for those sources. lead_form_automations is keyed by a real Facebook
// form_id (NOT NULL) normally, so these reuse that same table with a fixed,
// non-Facebook sentinel form_id per source instead — connection_id stays
// null (it's nullable; confirmed live), nothing Facebook-specific (sync,
// getFormLeads, the forms list on /dashboard/leads) ever matches a row it
// didn't create, since none of those paths know these sentinels exist.
export const LEAD_SOURCE_AUTOMATIONS = {
  landing_page: { formId: '__source_landing_page__', label: 'Landing Page / Website Form' },
  manual:       { formId: '__source_manual__',        label: 'Manually Added Leads' },
} as const

export type LeadSourceKind = keyof typeof LEAD_SOURCE_AUTOMATIONS

// Deliberately excludes CSV/bulk import — firing an instant WhatsApp send
// the moment someone uploads a few hundred contacts at once is a much
// bigger, riskier blast than a single landing-page submission or manual
// add, and this codebase already has a real, deliberate way to message a
// freshly-imported list: the existing "Message" bulk-send button on the
// Leads page (Campaigns), which a merchant explicitly triggers when ready.

// Queues an automated WhatsApp greeting for a newly created lead from a
// non-Facebook source, mirroring exactly what the Facebook Lead Ad flow
// does (same automation_jobs shape, same template rendering), just keyed
// by the fixed sentinel form_id above instead of a real Facebook form.
// Returns true if a job was actually queued.
export async function triggerLeadSourceAutomation(
  service: ServiceClient,
  params: { storeId: string; ownerId: string; leadId: string; source: LeadSourceKind; phone: string; name: string | null; fields?: Record<string, string> },
): Promise<boolean> {
  const { storeId, ownerId, leadId, source, phone, name, fields = {} } = params

  const { data: auto } = await service
    .from('lead_form_automations')
    .select('message_template, wa_template_name, wa_template_language')
    .eq('store_id', storeId)
    .eq('form_id', LEAD_SOURCE_AUTOMATIONS[source].formId)
    .eq('is_enabled', true)
    .maybeSingle()
  if (!auto?.message_template?.trim()) return false

  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('id')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()
  if (!wa) return false

  const vars = { ...fields, name: name ?? 'there', email: fields.email ?? '', phone }
  const message = renderTemplate(auto.message_template, vars)
  const waTemplateName = (auto.wa_template_name as string | null) || null
  const waTemplateLang = (auto.wa_template_language as string | null) || 'en'
  const waParams = waTemplateName ? extractTemplateParams(auto.message_template, vars) : undefined

  await service.from('automation_jobs').insert({
    store_id: storeId, automation_id: null, type: 'lead_ad',
    customer_phone: phone, customer_name: name ?? 'Lead', message,
    context: {
      lead_id: leadId, source,
      ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
    },
    status: 'pending', scheduled_at: new Date().toISOString(),
  })
  await service.from('leads').update({ wa_status: 'pending' }).eq('id', leadId)
  return true
}

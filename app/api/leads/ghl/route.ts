import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeIndianPhone, renderTemplate, extractTemplateParams } from '@/lib/utils'

// Go High Level webhook payload shapes
interface GHLCustomField {
  id?: string
  fieldKey?: string   // e.g. "contact.budget" or "budget"
  name?: string
  value?: string | string[]
}

interface GHLContact {
  id?: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  customFields?: GHLCustomField[]
  tags?: string[]
}

interface GHLPayload {
  type?: string           // "FormSubmission" | "ContactCreate" | "ContactUpdate" | etc.
  locationId?: string
  formId?: string
  form?: { id?: string; name?: string }
  contact?: GHLContact
  // GHL also sometimes sends flat fields at root level
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  customFields?: GHLCustomField[]
}

function parseGHLPayload(body: GHLPayload) {
  // Contact can be nested under .contact or flat at root (varies by GHL version / trigger type)
  const c: GHLContact = body.contact ?? body

  const firstName = c.firstName ?? ''
  const lastName  = c.lastName  ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const name = (c.name || fullName) || null
  const email = c.email ?? null
  const phone = c.phone ?? null

  // Source: form name if form submission, fallback to "GHL"
  const source = body.form?.name ?? (body.type === 'FormSubmission' ? 'GHL Form' : 'Go High Level')

  // Custom fields → flat key/value map
  const customFields: Record<string, string> = {}
  for (const f of c.customFields ?? []) {
    // fieldKey is "contact.budget" or just "budget" — strip "contact." prefix
    const rawKey = f.fieldKey ?? f.name ?? f.id ?? ''
    const key = rawKey.replace(/^contact\./, '').replace(/\s+/g, '_').toLowerCase()
    if (!key) continue
    const val = Array.isArray(f.value) ? f.value.join(', ') : (f.value ?? '')
    if (val) customFields[key] = val
  }

  return { name, email, phone, source, customFields }
}

// GHL webhooks authenticate via query param ?key=... (they can't set Authorization headers)
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('key')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing ?key= parameter' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, user_id')
    .eq('api_key', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  let body: GHLPayload
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { name, email, phone, source, customFields } = parseGHLPayload(body)

  if (!name && !phone && !email) {
    return NextResponse.json({ error: 'No contact data found in payload' }, { status: 400 })
  }

  const normalizedPhone = phone ? (normalizeIndianPhone(phone) ?? phone) : null

  const { data: saved, error: saveErr } = await supabase
    .from('leads')
    .insert({
      user_id:   store.user_id,
      store_id:  store.id,
      name:      name || null,
      email:     email || null,
      phone:     normalizedPhone,
      form_name: source,
      fields:    Object.keys(customFields).length > 0 ? customFields : null,
      wa_status: normalizedPhone ? 'imported' : 'no_phone',
    })
    .select('id')
    .single()

  if (saveErr || !saved) {
    console.error('[leads/ghl] save error:', saveErr)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  // Auto-trigger WhatsApp if an enabled automation matches the source
  if (normalizedPhone) {
    const { data: autos } = await supabase
      .from('lead_form_automations')
      .select('message_template, wa_template_name, wa_template_language, form_name')
      .eq('store_id', store.id)
      .eq('is_enabled', true)

    const auto = autos?.find(a => a.form_name?.toLowerCase() === source.toLowerCase())
      ?? autos?.find(a => a.form_name?.toLowerCase() === 'go high level')
      ?? autos?.find(a => a.form_name?.toLowerCase() === 'ghl form')

    if (auto) {
      const { data: wa } = await supabase
        .from('whatsapp_accounts')
        .select('id')
        .eq('user_id', store.user_id)
        .eq('status', 'connected')
        .maybeSingle()

      if (wa) {
        const vars = {
          ...customFields,
          name: name ?? 'there',
          email: email ?? '',
          phone: normalizedPhone,
        }
        const message = renderTemplate(auto.message_template, vars)
        const waTemplateName = (auto.wa_template_name as string | null) || null
        const waTemplateLang = (auto.wa_template_language as string | null) || 'en'
        const waParams = waTemplateName ? extractTemplateParams(auto.message_template, vars) : undefined

        await supabase.from('automation_jobs').insert({
          store_id:       store.id,
          automation_id:  null,
          type:           'lead_ad',
          customer_phone: normalizedPhone,
          customer_name:  name ?? 'Lead',
          message,
          context: {
            lead_id: saved.id,
            source,
            ghl_contact_id: body.contact?.id ?? null,
            ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
          },
          status:       'pending',
          scheduled_at: new Date().toISOString(),
        })

        await supabase.from('leads').update({ wa_status: 'pending' }).eq('id', saved.id)
      }
    }
  }

  // GHL expects a 200 with any JSON body
  return NextResponse.json({ success: true, lead_id: saved.id })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

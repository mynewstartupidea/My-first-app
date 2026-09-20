import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeIndianPhone, renderTemplate, extractTemplateParams } from '@/lib/utils'

const STANDARD_KEYS = new Set(['name', 'email', 'phone', 'source', 'full_name', 'first_name', 'last_name'])

export async function POST(req: Request) {
  // Auth via Bearer token
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })

  const supabase = createServiceClient()

  // Look up store by api_key
  const { data: store } = await supabase
    .from('stores')
    .select('id, user_id')
    .eq('api_key', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  let body: Record<string, string>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { name, email, phone, source, ...rest } = body
  if (!name && !phone && !email) {
    return NextResponse.json({ error: 'Provide at least one of: name, phone, email' }, { status: 400 })
  }

  // Normalize phone to E.164-ish Indian format when possible
  const normalizedPhone = phone ? (normalizeIndianPhone(phone) ?? phone) : null

  // Custom fields — everything except standard keys
  const fields = Object.fromEntries(Object.entries(rest).filter(([k]) => !STANDARD_KEYS.has(k)))

  // Save lead
  const { data: saved, error: saveErr } = await supabase
    .from('leads')
    .insert({
      user_id:   store.user_id,
      store_id:  store.id,
      name:      name || null,
      email:     email || null,
      phone:     normalizedPhone,
      form_name: source || 'Landing Page',
      fields:    Object.keys(fields).length > 0 ? fields : null,
      wa_status: normalizedPhone ? 'imported' : 'no_phone',
    })
    .select('id')
    .single()

  if (saveErr || !saved) {
    console.error('[leads/ingest] save error:', saveErr)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  // Auto-trigger WhatsApp if there is an enabled automation for this source/store
  if (normalizedPhone) {
    const sourceName = source || 'Landing Page'

    // Find automation matching source name, or any enabled one as fallback
    const { data: autos } = await supabase
      .from('lead_form_automations')
      .select('message_template, wa_template_name, wa_template_language, form_name')
      .eq('store_id', store.id)
      .eq('is_enabled', true)

    const auto = autos?.find(a => a.form_name?.toLowerCase() === sourceName.toLowerCase())
      ?? autos?.find(a => a.form_name?.toLowerCase() === 'landing page')

    if (auto) {
      const { data: wa } = await supabase
        .from('whatsapp_accounts')
        .select('id')
        .eq('user_id', store.user_id)
        .eq('status', 'connected')
        .maybeSingle()

      if (wa) {
        const vars = { ...fields, name: name ?? 'there', email: email ?? '', phone: normalizedPhone }
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
            source: sourceName,
            ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
          },
          status:       'pending',
          scheduled_at: new Date().toISOString(),
        })

        await supabase.from('leads').update({ wa_status: 'pending' }).eq('id', saved.id)
      }
    }
  }

  return NextResponse.json({ success: true, lead_id: saved.id })
}

// CORS preflight for cross-origin landing page submissions
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

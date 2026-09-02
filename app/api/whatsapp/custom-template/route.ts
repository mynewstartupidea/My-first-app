import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const EXAMPLE_VALUES: Record<string, string> = {
  name:          'John',
  phone:         '+91 98765 43210',
  shop_name:     'My Store',
  order_number:  '12345',
  amount:        '999',
  tracking_url:  'https://track.example.com',
  cart_url:      'https://shop.example.com/cart',
  review_url:    'https://shop.example.com/review',
  discount_code: 'SAVE10',
  discount_value:'10',
  product_name:  'Blue T-Shirt',
  product_url:   'https://shop.example.com/product',
  shop_url:      'https://shop.example.com',
}

function toMetaBody(body: string) {
  const seen = new Set<string>()
  const varOrder: string[] = []
  for (const [, key] of body.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(key)) { seen.add(key); varOrder.push(key) }
  }
  let metaBody = body
  varOrder.forEach((varName, i) => {
    metaBody = metaBody.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), `{{${i + 1}}}`)
  })
  const exampleValues = varOrder.map((v, i) => EXAMPLE_VALUES[v] ?? `value${i + 1}`)
  return { metaBody, exampleValues }
}

async function getWABA(userId: string) {
  const service = createServiceClient()
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('waba_id, access_token')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .maybeSingle()
  return wa
}

// POST — submit a custom template to Meta for approval
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { templateId?: string }
  if (!body.templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 })

  const { data: tmpl } = await supabase
    .from('templates')
    .select('*')
    .eq('id', body.templateId)
    .eq('user_id', user.id)
    .single()

  if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const wa = await getWABA(user.id)
  if (!wa?.waba_id) return NextResponse.json({ error: 'WhatsApp not connected. Go to Settings → WhatsApp to connect first.' }, { status: 400 })

  // Generate unique lowercase Meta template name
  const sanitized = (tmpl.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 8)
  const metaName = `wapaci_${sanitized}_${suffix}`

  const { metaBody, exampleValues } = toMetaBody(tmpl.body as string)
  const metaCategory = (tmpl.category as string) === 'utility' ? 'UTILITY' : 'MARKETING'
  const token = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? (wa.access_token as string)

  const res = await fetch(`https://graph.facebook.com/v21.0/${wa.waba_id}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:       metaName,
      language:   'en',
      category:   metaCategory,
      components: [{
        type: 'BODY',
        text: metaBody,
        ...(exampleValues.length > 0 ? { example: { body_text: [exampleValues] } } : {}),
      }],
    }),
  })

  const data = await res.json() as { id?: string; error?: { code: number; message: string } }

  if (res.ok && data.id) {
    await supabase.from('templates').update({
      meta_status:        'PENDING',
      meta_template_name: metaName,
      updated_at:         new Date().toISOString(),
    }).eq('id', body.templateId)

    return NextResponse.json({ ok: true, metaName, status: 'PENDING' })
  }

  return NextResponse.json({ ok: false, error: data.error?.message ?? 'Meta submission failed' }, { status: 400 })
}

// GET — sync live Meta approval status for all user's submitted custom templates
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: submitted } = await supabase
    .from('templates')
    .select('id, meta_template_name, meta_status')
    .eq('user_id', user.id)
    .not('meta_template_name', 'is', null)

  if (!submitted?.length) return NextResponse.json({ updated: 0 })

  const wa = await getWABA(user.id)
  if (!wa?.waba_id) return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })

  const token = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? (wa.access_token as string)
  const names = submitted.map(t => t.meta_template_name).join(',')

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wa.waba_id}/message_templates?fields=name,status&limit=50&name=${encodeURIComponent(names)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const metaData = await res.json() as { data?: { name: string; status: string }[] }

  const statusMap: Record<string, string> = {}
  for (const t of metaData.data ?? []) statusMap[t.name] = t.status

  let updated = 0
  for (const tmpl of submitted) {
    const newStatus = statusMap[tmpl.meta_template_name as string]
    if (newStatus && newStatus !== tmpl.meta_status) {
      await supabase.from('templates')
        .update({ meta_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', tmpl.id)
      updated++
    }
  }

  return NextResponse.json({ updated })
}

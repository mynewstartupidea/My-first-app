import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const token   = process.env.META_ACCESS_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return NextResponse.json(
      { error: 'META_ACCESS_TOKEN or META_PHONE_NUMBER_ID not set in environment' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({})) as { to?: string }
  const to   = String(body.to ?? '').replace(/\s+/g, '')

  if (!to) {
    return NextResponse.json({ error: 'Missing phone number' }, { status: 400 })
  }

  const url     = `https://graph.facebook.com/v25.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: '🚀 Wapaci test message from Meta Cloud API' },
  }

  const metaRes  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  const metaBody = await metaRes.json().catch(() => null)

  return NextResponse.json({
    status:   metaRes.status,
    ok:       metaRes.ok,
    body:     metaBody,
    url,
    phoneId,
  })
}

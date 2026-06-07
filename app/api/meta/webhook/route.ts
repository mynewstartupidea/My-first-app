// Meta WhatsApp Cloud API — inbound webhook
// Handles: incoming messages, delivery updates, read receipts

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'wapaci_webhook_verify'

// ─── GET — webhook verification (Meta challenges this endpoint) ───────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — receive events ────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.json() as MetaWebhookPayload

  const supabase = createServiceClient()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      // ── Incoming messages ──────────────────────────────────────────────────
      for (const msg of value.messages ?? []) {
        const fromPhone = msg.from
        const wabaId    = value.metadata?.phone_number_id ?? ''
        const toPhone   = value.metadata?.display_phone_number ?? ''
        const msgBody   = msg.type === 'text' ? msg.text?.body ?? '' : `[${msg.type}]`

        // Find store by phone_number_id
        const { data: waAccount } = await supabase
          .from('whatsapp_accounts')
          .select('store_id, user_id')
          .eq('phone_number_id', wabaId)
          .maybeSingle()

        await supabase.from('inbound_messages').insert({
          store_id:    waAccount?.store_id ?? null,
          waba_id:     wabaId,
          from_phone:  fromPhone,
          to_phone:    toPhone,
          message_id:  msg.id,
          message_type: msg.type,
          body:        msgBody,
          status:      'received',
          raw_payload: msg as unknown as Record<string, unknown>,
        })

        // Auto-respond with "Thanks, we'll be in touch!" — placeholder
        // Real two-way inbox: future feature
      }

      // ── Delivery / read status updates ────────────────────────────────────
      for (const status of value.statuses ?? []) {
        const newStatus = status.status === 'delivered' ? 'delivered'
          : status.status === 'read' ? 'read'
          : status.status === 'failed' ? 'failed'
          : null

        if (newStatus && status.id) {
          await supabase.from('messages').update({ status: newStatus })
            .eq('bsp_message_id', status.id)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaWebhookPayload {
  entry?: {
    id: string
    changes?: {
      value: {
        metadata?: { phone_number_id: string; display_phone_number: string }
        messages?: {
          id: string
          from: string
          type: string
          text?: { body: string }
          timestamp: string
        }[]
        statuses?: {
          id: string
          status: string
          recipient_id: string
        }[]
      }
      field: string
    }[]
  }[]
}

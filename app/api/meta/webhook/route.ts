// Meta WhatsApp Cloud API — inbound webhook
// Handles: incoming messages, delivery updates, read receipts

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'wapaci_webhook_verify'

// ─── GET — webhook verification ───────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log(`[Meta webhook] verification — mode=${mode} token_match=${token === VERIFY_TOKEN} challenge=${challenge}`)

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta webhook] verification SUCCESS — responding with challenge')
    return new Response(challenge ?? '', { status: 200 })
  }

  console.error(`[Meta webhook] verification FAILED — expected token="${VERIFY_TOKEN}" got="${token}"`)
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — receive events ────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: MetaWebhookPayload
  try {
    body = await request.json() as MetaWebhookPayload
  } catch {
    console.error('[Meta webhook] failed to parse body')
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = createServiceClient()
  const entryCount   = body.entry?.length ?? 0
  let msgCount    = 0
  let statusCount = 0

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      // ── Incoming messages ──────────────────────────────────────────────────
      for (const msg of value.messages ?? []) {
        msgCount++
        const fromPhone  = msg.from
        const wabaId     = value.metadata?.phone_number_id ?? ''
        const toPhone    = value.metadata?.display_phone_number ?? ''
        const msgBody    = msg.type === 'text' ? msg.text?.body ?? '' : `[${msg.type}]`

        console.log(`[Meta webhook] inbound msg from=${fromPhone} wabaId=${wabaId} type=${msg.type}`)

        const { data: waAccount } = await supabase
          .from('whatsapp_accounts')
          .select('store_id, user_id')
          .eq('phone_number_id', wabaId)
          .maybeSingle()

        if (!waAccount) {
          console.warn(`[Meta webhook] no whatsapp_account for phone_number_id=${wabaId}`)
        }

        const { error: insertErr } = await supabase.from('inbound_messages').insert({
          store_id:     waAccount?.store_id ?? null,
          waba_id:      wabaId,
          from_phone:   fromPhone,
          to_phone:     toPhone,
          message_id:   msg.id,
          message_type: msg.type,
          body:         msgBody,
          status:       'received',
          raw_payload:  msg as unknown as Record<string, unknown>,
        })

        if (insertErr) console.error('[Meta webhook] inbound_messages insert error:', insertErr.message)
      }

      // ── Delivery / read status updates ────────────────────────────────────
      for (const status of value.statuses ?? []) {
        statusCount++
        const newStatus = status.status === 'delivered' ? 'delivered'
          : status.status === 'read'      ? 'read'
          : status.status === 'failed'    ? 'failed'
          : null

        console.log(`[Meta webhook] status update msgId=${status.id} status=${status.status} → ${newStatus ?? 'ignored'}`)

        if (newStatus && status.id) {
          const { error: updateErr } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('bsp_message_id', status.id)
          if (updateErr) console.error('[Meta webhook] messages status update error:', updateErr.message)
        }
      }
    }
  }

  console.log(`[Meta webhook] processed entries=${entryCount} messages=${msgCount} statusUpdates=${statusCount}`)
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

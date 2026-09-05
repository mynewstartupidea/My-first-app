// Meta WhatsApp Cloud API — inbound webhook
// Handles: incoming messages, delivery updates, read receipts

export const dynamic = 'force-dynamic'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyMetaSignature(rawBody: string, signatureHeader: string): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    // Refuse all requests rather than silently bypassing auth in production.
    // Set META_APP_SECRET in env to enable the webhook.
    console.error('[Meta webhook] META_APP_SECRET not configured — rejecting request')
    return false
  }
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

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
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  if (!verifyMetaSignature(rawBody, signature)) {
    console.error('[Meta webhook] signature verification failed')
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: MetaWebhookPayload
  try {
    body = JSON.parse(rawBody) as MetaWebhookPayload
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

      // ── WhatsApp account quality / limit change ────────────────────────────
      if (change.field === 'phone_number_quality_update') {
        const v = value as unknown as {
          display_phone_number?: string
          event?: string          // FLAGGED | DOWNGRADED | RECOVERY_STARTED | RECOVERY_COMPLETED
          current_limit?: string
        }
        console.log(`[Meta webhook] quality update event=${v.event} phone=${v.display_phone_number} limit=${v.current_limit}`)

        if (v.display_phone_number && v.event) {
          const newRating =
            v.event === 'FLAGGED'             ? 'YELLOW' :
            v.event === 'RECOVERY_COMPLETED'  ? 'GREEN'  : null

          const { data: waAccount } = await supabase
            .from('whatsapp_accounts')
            .select('user_id, quality_rating')
            .eq('display_phone_number', v.display_phone_number)
            .maybeSingle()

          if (waAccount) {
            const updates: Record<string, string> = {}
            if (newRating) updates.quality_rating = newRating
            if (v.current_limit) updates.messaging_limit_tier = v.current_limit
            if (Object.keys(updates).length > 0) {
              await supabase.from('whatsapp_accounts').update(updates).eq('user_id', waAccount.user_id)
            }

            // Notify on degradation (only when actually getting worse)
            if (newRating && newRating !== 'GREEN' && waAccount.quality_rating !== newRating) {
              await supabase.from('notifications').insert({
                user_id: waAccount.user_id,
                type:    'wa_health_flagged',
                title:   '⚠️ WhatsApp quality rating dropped',
                body:    'Your account quality is dropping — leads may be blocking your messages. Avoid bulk sending and review your templates.',
                link:    '/dashboard/settings?tab=whatsapp',
                is_read: false,
              })
              console.log(`[Meta webhook] quality notification sent to user=${waAccount.user_id} newRating=${newRating}`)
            }
          }
        }
        continue
      }

      // ── Account-level ban / restriction ───────────────────────────────────
      if (change.field === 'account_update') {
        const v = value as unknown as {
          event?: string
          ban_info?: { waba_ban_state?: string }
        }
        const isBanned = v.event === 'FLAGGED' || v.ban_info?.waba_ban_state === 'DISABLE'
        if (isBanned) {
          const { data: waAccount } = await supabase
            .from('whatsapp_accounts')
            .select('user_id')
            .eq('waba_id', entry.id)
            .maybeSingle()

          if (waAccount) {
            await supabase.from('whatsapp_accounts')
              .update({ quality_rating: 'RED' })
              .eq('user_id', waAccount.user_id)

            await supabase.from('notifications').insert({
              user_id: waAccount.user_id,
              type:    'wa_health_flagged',
              title:   '🔴 WhatsApp account restricted by Meta',
              body:    'Your WhatsApp Business account has been disabled. Stop all sending and contact Meta support immediately.',
              link:    '/dashboard/settings?tab=whatsapp',
              is_read: false,
            })
            console.log(`[Meta webhook] account banned notification sent to user=${waAccount.user_id}`)
          }
        }
        continue
      }

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
    id: string   // waba_id for account_update events
    changes?: {
      value: Record<string, unknown> & {
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

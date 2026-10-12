// AI auto-reply for inbound WhatsApp messages — generates a reply grounded
// ONLY in the merchant's knowledge base (edited on /dashboard/ai-assistant)
// and sends it via their connected WhatsApp number. Wired into the inbound
// webhook, guarded so it never fires alongside an in-progress lead-qualifying
// flow — two automated messages answering the same inbound text would read
// as the business double-texting the same lead.

import { createServiceClient } from '@/lib/supabase/server'
import { sendStoreWhatsAppText } from '@/lib/send-store-message'

type ServiceClient = ReturnType<typeof createServiceClient>

// Fast + cheap — grounded, short-form WhatsApp replies are simple lookups
// against the knowledge base, not open-ended reasoning, so a small non-
// reasoning model is the right cost/latency tradeoff for a feature that runs
// on every inbound message. Prefer OpenAI when a key is configured (checked
// live: gpt-4o-mini replies instantly with zero reasoning-token overhead;
// gpt-5-mini is a reasoning model and silently returned an EMPTY reply after
// burning its whole token budget on hidden reasoning — wrong fit here) and
// fall back to Anthropic so either key alone is enough to enable the feature.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const OPENAI_MODEL = 'gpt-4o-mini'
const MAX_HISTORY_MESSAGES = 12
const MIN_KNOWLEDGE_LENGTH = 20

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

// Tells WhatsApp to show the native "typing…" bubble and blue double-tick on
// the customer's side — same signal a real person replying from the app
// gives. Meta auto-dismisses it after 25s or once we actually send, so it
// only ever needs to cover the generation + pacing delay below. Best-effort:
// swallows its own errors so a hiccup here (bad token, etc.) never blocks
// the actual reply.
async function markReadWithTypingIndicator(service: ServiceClient, userId: string, messageId: string): Promise<void> {
  try {
    const { data: wa } = await service
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token')
      .eq('user_id', userId)
      .maybeSingle()
    const phoneNumberId = wa?.phone_number_id
    const apiKey = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa?.access_token
    if (!phoneNumberId || !apiKey) return
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', status: 'read', message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
    })
  } catch (e) {
    console.error('[AI reply] typing indicator failed (non-fatal):', e)
  }
}

// An instant reply reads as an obvious bot. Loosely scaled by reply length
// (reading + typing a longer message takes longer) and capped well under
// the typing indicator's 25s auto-dismiss above.
function humanPaceDelayMs(replyText: string): number {
  const base = 2000 + Math.random() * 2500
  const perChar = Math.min(replyText.length * 35, 5500)
  return Math.round(base + perChar)
}

// Anthropic's Messages API requires strict role alternation (two consecutive
// 'user' entries is a guaranteed 400) — but the inbound-history query below
// always includes the message currently being replied to (it's already been
// upserted into inbound_messages by the webhook before this runs), and that
// row then gets appended a second time as the explicit current-turn message.
// Every single call hit this on every inbound message, which is why AI
// auto-reply never actually sent anything — confirmed live, not a rare edge
// case. Merging consecutive same-role turns (instead of trying to exclude
// "the current message" by id, which breaks if someone double-texts before
// this runs) fixes this and any other source of back-to-back same-role turns.
function mergeConsecutiveSameRole(
  messages: { role: 'user' | 'assistant'; content: string }[],
): { role: 'user' | 'assistant'; content: string }[] {
  const merged: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.content += '\n' + m.content
    else merged.push({ ...m })
  }
  return merged
}

// A failure here used to only ever reach a console.error — no row in any
// table, no notification, nothing a merchant (or anyone debugging without
// Vercel log access) could query to find out why AI auto-reply didn't fire.
// The toggle could show "on" indefinitely while silently never having sent
// a single reply, with literally zero trace anywhere. Writes a 'failed'
// messages row (same table every other send path's failures land in) only
// for genuine misconfiguration/errors — never for the two expected, correct
// no-ops (feature off, mid-qualifying-flow) which aren't failures at all.
async function recordAiReplyFailure(service: ServiceClient, storeId: string, phone: string, reason: string): Promise<void> {
  await service.from('messages').insert({
    store_id: storeId, customer_phone: phone, type: 'ai_reply',
    message: '', status: 'failed', metadata: { delivery_error: { details: reason } },
  }).then(() => null, () => null)
}

export async function maybeSendAIReply(
  service: ServiceClient,
  params: { storeId: string; userId: string; phone: string; text: string; inboundMessageId?: string },
): Promise<void> {
  const { storeId, userId, phone, text, inboundMessageId } = params
  if (!text.trim()) return

  const { data: store } = await service
    .from('stores')
    .select('ai_reply_enabled, shop_name')
    .eq('id', storeId)
    .maybeSingle()
  if (!store?.ai_reply_enabled) return

  // Don't double-text: a lead mid-qualifying-flow already gets an automated
  // message for this same inbound reply from advanceQualifyingFlow.
  const phoneSuffix = last10Digits(phone)
  const { data: inProgress } = await service
    .from('lead_qualifying_progress')
    .select('id')
    .eq('store_id', storeId)
    .eq('phone', phoneSuffix)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (inProgress) return

  const { data: kb } = await service
    .from('ai_knowledge_base')
    .select('content')
    .eq('store_id', storeId)
    .maybeSingle()
  const knowledge = (kb?.content ?? '').trim()
  // Nothing to ground a reply on — stay silent rather than let the model
  // improvise business facts. The toggle route already refuses to enable
  // this without content, but a merchant could clear it out afterward.
  if (knowledge.length < MIN_KNOWLEDGE_LENGTH) {
    await recordAiReplyFailure(service, storeId, phone, 'Knowledge base is empty or too short — AI auto-reply has nothing to answer from.')
    return
  }

  const openaiKey    = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!openaiKey && !anthropicKey) {
    console.error('[AI reply] no AI provider key set — skipping')
    await recordAiReplyFailure(service, storeId, phone, 'No AI provider is configured on the server (missing OPENAI_API_KEY or ANTHROPIC_API_KEY).')
    return
  }

  // Fire the "typing…" indicator now, before generation starts, so it's
  // live for the full wait — not just the pacing delay tacked on at the end.
  if (inboundMessageId) void markReadWithTypingIndicator(service, userId, inboundMessageId)

  const [{ data: outbound }, { data: inbound }] = await Promise.all([
    service.from('messages').select('message, created_at')
      .eq('store_id', storeId).eq('customer_phone', phone)
      .order('created_at', { ascending: false }).limit(MAX_HISTORY_MESSAGES),
    service.from('inbound_messages').select('body, received_at')
      .eq('store_id', storeId).eq('from_phone', phone)
      .order('received_at', { ascending: false }).limit(MAX_HISTORY_MESSAGES),
  ])

  type Turn = { role: 'user' | 'assistant'; content: string; at: string }
  const turns: Turn[] = [
    ...(outbound ?? []).map(m => ({ role: 'assistant' as const, content: m.message as string, at: m.created_at as string })),
    ...(inbound ?? []).map(m => ({ role: 'user' as const, content: (m.body as string) ?? '', at: m.received_at as string })),
  ]
    .filter(t => t.content)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-MAX_HISTORY_MESSAGES)

  const businessName = store.shop_name ?? 'this business'
  const system = `You are answering WhatsApp messages on behalf of ${businessName}. Use ONLY the information below to answer — never invent prices, policies, or facts that aren't stated here. Keep replies short and natural, like a real WhatsApp message (1-3 sentences, plain text, no markdown, no headers, no bullet lists).

If the question is about ${businessName} (its products, services, pricing, policies, etc.) but the answer isn't in the information below, say a team member will follow up shortly instead of guessing.

If the question has nothing to do with ${businessName} (general knowledge, recipes, unrelated topics), don't offer to follow up on it — that would wrongly imply someone will get back to them about it. Just briefly, politely say you're only able to help with questions about ${businessName}, and ask what they'd like to know.

--- Business information ---
${knowledge}`

  const mergedTurns = mergeConsecutiveSameRole([...turns.map(t => ({ role: t.role, content: t.content })), { role: 'user', content: text }])
  const provider = openaiKey ? 'openai' : 'anthropic'

  let replyText: string
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 300,
          messages: [{ role: 'system', content: system }, ...mergedTurns],
        }),
      })
      const data = await res.json() as { choices?: { message?: { content?: string } }[]; error?: { message: string } }
      if (!res.ok || data.error) {
        const reason = data.error?.message ?? `OpenAI API error (HTTP ${res.status})`
        console.error('[AI reply] OpenAI API error:', reason)
        await recordAiReplyFailure(service, storeId, phone, reason)
        return
      }
      replyText = data.choices?.[0]?.message?.content?.trim() ?? ''
      if (!replyText) {
        await recordAiReplyFailure(service, storeId, phone, 'OpenAI returned an empty reply.')
        return
      }
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey as string,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 300,
          system,
          messages: mergedTurns,
        }),
      })
      const data = await res.json() as { content?: { type: string; text?: string }[]; error?: { message: string } }
      if (!res.ok || data.error) {
        const reason = data.error?.message ?? `Anthropic API error (HTTP ${res.status})`
        console.error('[AI reply] Anthropic API error:', reason)
        await recordAiReplyFailure(service, storeId, phone, reason)
        return
      }
      replyText = data.content?.find(c => c.type === 'text')?.text?.trim() ?? ''
      if (!replyText) {
        await recordAiReplyFailure(service, storeId, phone, 'Anthropic returned an empty reply.')
        return
      }
    }
  } catch (e) {
    console.error('[AI reply] generation failed:', e)
    await recordAiReplyFailure(service, storeId, phone, `Request to ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} failed: ${String(e)}`)
    return
  }

  await new Promise(resolve => setTimeout(resolve, humanPaceDelayMs(replyText)))

  const result = await sendStoreWhatsAppText(service, {
    storeId, userId, phone, message: replyText, type: 'ai_reply',
  })
  if (!result.success) console.error('[AI reply] send failed:', result.error)
}

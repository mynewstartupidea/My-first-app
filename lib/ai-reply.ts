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
// against the knowledge base, not open-ended reasoning, so Haiku is the right
// cost/latency tradeoff for a feature that runs on every inbound message.
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_HISTORY_MESSAGES = 12
const MIN_KNOWLEDGE_LENGTH = 20

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export async function maybeSendAIReply(
  service: ServiceClient,
  params: { storeId: string; userId: string; phone: string; text: string },
): Promise<void> {
  const { storeId, userId, phone, text } = params
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
  if (knowledge.length < MIN_KNOWLEDGE_LENGTH) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[AI reply] ANTHROPIC_API_KEY not set — skipping')
    return
  }

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
  const system = `You are answering WhatsApp messages on behalf of ${businessName}. Use ONLY the information below to answer — never invent prices, policies, or facts that aren't stated here. Keep replies short and natural, like a real WhatsApp message (1-3 sentences, plain text, no markdown, no headers, no bullet lists). If the answer isn't in the information below, say a team member will follow up shortly instead of guessing.

--- Business information ---
${knowledge}`

  let replyText: string
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system,
        messages: [...turns.map(t => ({ role: t.role, content: t.content })), { role: 'user', content: text }],
      }),
    })
    const data = await res.json() as { content?: { type: string; text?: string }[]; error?: { message: string } }
    if (!res.ok || data.error) {
      console.error('[AI reply] Anthropic API error:', data.error?.message ?? res.status)
      return
    }
    replyText = data.content?.find(c => c.type === 'text')?.text?.trim() ?? ''
    if (!replyText) return
  } catch (e) {
    console.error('[AI reply] generation failed:', e)
    return
  }

  const result = await sendStoreWhatsAppText(service, {
    storeId, userId, phone, message: replyText, type: 'ai_reply',
  })
  if (!result.success) console.error('[AI reply] send failed:', result.error)
}

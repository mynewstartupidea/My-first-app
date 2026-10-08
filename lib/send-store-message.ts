import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

// Resolves the merchant's own connected WhatsApp credentials (falling back to
// platform env vars — same precedence /api/whatsapp/test uses), sends a
// freeform text message, and logs it to `messages`. Shared by the Live Chat
// "send" route and the AI auto-reply path — both need the exact same
// "send as this merchant" behavior, just triggered from different places.
export async function sendStoreWhatsAppText(
  service: ServiceClient,
  params: { storeId: string; userId: string; phone: string; message: string; type: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { storeId, userId, phone, message, type } = params

  // AI auto-reply and manual Live Chat replies both go through this one
  // function — unlike the cron-driven automation sends and campaign sends,
  // neither checked the plan's message quota at all, so both paths could
  // send unlimited free messages past a merchant's plan limit.
  // try_increment_messages_used (supabase/migrations.sql) checks-and-
  // increments atomically, same gate the cron paths already use.
  const { data: allowed } = await service.rpc('try_increment_messages_used', { p_user_id: userId })
  if (!allowed) {
    return { success: false, error: 'Monthly message limit reached. Upgrade your plan to send more messages.' }
  }

  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token, provider')
    .eq('user_id', userId)
    .maybeSingle()

  const result = await sendWhatsAppMessage({
    to: phone,
    message,
    apiKey: wa?.access_token ?? undefined,
    phoneNumberId: wa?.phone_number_id ?? undefined,
    bsp: wa?.provider ?? undefined,
  })

  // Refund the credit on a failed send — same reasoning as the cron paths:
  // a quota charge should only stick for a message that actually went out.
  if (!result.success) {
    await service.rpc('decrement_messages_used', { p_user_id: userId }).then(() => null, () => null)
  }

  await service.from('messages').insert({
    store_id: storeId,
    customer_phone: phone,
    type,
    message,
    status: result.success ? 'sent' : 'failed',
    bsp_message_id: result.messageId ?? null,
  })

  return result
}

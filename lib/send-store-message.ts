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

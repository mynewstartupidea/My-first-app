// Send a test WhatsApp message to a specific phone number.
// Used from Settings → WhatsApp tab.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { STARTER_TEMPLATES, getTemplateStatuses } from '@/lib/whatsapp-templates'
import { extractTemplateParams } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body  = await request.json().catch(() => ({})) as { phone?: string; message?: string }
  const rawPhone = (body.phone ?? '').replace(/\s/g, '')
  if (!rawPhone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const phone = normalizePhone(rawPhone)

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores')
    .select('id, whatsapp_bsp, whatsapp_api_key, shop_name')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .maybeSingle()

  // Try merchant's own connected WhatsApp account first
  let merchantToken: string | undefined
  let merchantPhoneNumberId: string | undefined
  let merchantWabaId: string | undefined
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, waba_id, access_token')
    .eq('user_id', ownerId)
    .maybeSingle()
  if (wa?.phone_number_id) {
    merchantPhoneNumberId = wa.phone_number_id
    merchantWabaId        = wa.waba_id ?? undefined
    merchantToken         = wa.access_token ?? store?.whatsapp_api_key ?? undefined
  }

  // Resolve final credentials: merchant > platform env vars
  const token   = merchantToken         ?? process.env.META_ACCESS_TOKEN
  const phoneId = merchantPhoneNumberId ?? process.env.META_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return NextResponse.json({
      success: false,
      error:   'No WhatsApp credentials available. Connect your WhatsApp account first, or contact support.',
    })
  }

  type MetaSendResult = { messages?: { id: string }[]; error?: { message: string; code?: number; error_data?: { details: string } } }
  const sendToMeta = (payload: Record<string, unknown>) =>
    fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messaging_product: 'whatsapp', to: phone, ...payload }),
    })

  const describeError = (metaData: MetaSendResult, status: number) =>
    metaData.error?.code === 131030 ? 'Your number is not whitelisted as a test recipient in Meta App Dashboard → WhatsApp → API Setup → Test recipients' :
    metaData.error?.code === 131026 ? `${phone} is not registered on WhatsApp` :
    metaData.error?.code === 190     ? 'Access token expired — regenerate in Meta App Dashboard' :
    metaData.error?.error_data?.details ?? metaData.error?.message ?? `Meta error (HTTP ${status})`

  const typedMessage = body.message?.trim()
  let sentAs = ''

  // If this phone already has an open 24h conversation window (it messaged
  // the business number first, or replied to something), whatever was
  // typed in the optional message box can go out as plain free text — no
  // template needed at all. Try that first instead of discarding it, which
  // is what this route used to do: `message` was accepted in the request
  // body but never actually sent, silently ignored in favor of always
  // sending hello_world regardless of what was typed.
  let metaRes: Response | undefined
  let metaData: MetaSendResult = {}
  if (typedMessage) {
    metaRes  = await sendToMeta({ type: 'text', text: { body: typedMessage } })
    metaData = await metaRes.json() as MetaSendResult
    if (metaRes.ok && metaData.messages?.[0]?.id) sentAs = typedMessage
    // 131047 = "re-engagement message" — no open window, a template is
    // required. Any OTHER failure (bad token, number not on WhatsApp, etc.)
    // is a real error worth surfacing directly rather than masking behind
    // a template attempt that would fail for the same underlying reason.
    else if (metaData.error?.code !== 131047) {
      return NextResponse.json({ success: false, error: describeError(metaData, metaRes.status), phone })
    }
  }

  // hello_world is a special template Meta pre-approves for every account,
  // but it can ONLY be sent from Meta's own Public Test Numbers (the
  // temporary number in Meta App Dashboard → API Setup) — Meta rejects it
  // outright from a real, registered business number with "Hello World
  // templates can only be sent from the Public Test Numbers." It only ever
  // worked here when falling back to platform env-var credentials (which
  // point at that test number); for a real merchant connection it always
  // failed. Use one of the merchant's own Meta-approved templates instead.
  if (!sentAs) {
    let templateName = 'hello_world'
    let templateLanguage = 'en_US'
    let templateParams: string[] = []

    if (merchantPhoneNumberId && merchantWabaId) {
      const statuses = await getTemplateStatuses(merchantWabaId, token)
      const approved = STARTER_TEMPLATES.find(t => statuses[t.name] === 'APPROVED')
      if (!approved) {
        return NextResponse.json({
          success: false,
          error: "You don't have any Meta-approved templates yet, so a test message can't be sent to open a new conversation. Check the Templates page for approval status — this usually takes a few hours for a new WhatsApp number — or message this number from your own WhatsApp first, then it can send your typed message as plain text instead.",
        })
      }
      templateName     = approved.name
      templateLanguage = approved.language
      const vars = { name: 'Test', phone, email: '' }
      templateParams = extractTemplateParams(approved.bodyPreview, vars)
    }

    metaRes  = await sendToMeta({
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        ...(templateParams.length ? { components: [{ type: 'body', parameters: templateParams.map(text => ({ type: 'text', text })) }] } : {}),
      },
    })
    metaData = await metaRes.json() as MetaSendResult
    if (metaRes.ok && metaData.messages?.[0]?.id) sentAs = `${templateName} template`
  }

  const messageId = metaData.messages?.[0]?.id
  const success   = !!sentAs && !!messageId
  const errorMsg  = success ? undefined : describeError(metaData, metaRes?.status ?? 500)

  if (success && store) {
    await service.from('messages').insert({
      store_id:       store.id,
      customer_phone: phone,
      customer_name:  'Test',
      type:           'test',
      message:        sentAs,
      status:         'sent',
      bsp_message_id: messageId,
      metadata:       { test: true },
    }).then(() => null)
  }

  return NextResponse.json({
    success,
    messageId: messageId ?? null,
    error:     errorMsg,
    phone,
    via: merchantPhoneNumberId ? 'merchant_account' : 'platform_credentials',
  })
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (phone.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  return `+${digits}`
}

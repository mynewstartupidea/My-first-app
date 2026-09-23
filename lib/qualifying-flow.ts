// Qualifying chatbot flow — a lead's first WhatsApp reply opens the 24h session
// window, so we walk them through the ordered questions configured on their
// form's automation, one freeform message at a time, and save each answer.

import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

type ServiceClient = ReturnType<typeof createServiceClient>

const CLOSING_MESSAGE = "Thanks for sharing! Our team will get back to you shortly."

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export async function advanceQualifyingFlow(
  service: ServiceClient,
  params: { storeId: string; phone: string; text: string },
): Promise<void> {
  const { storeId, phone, text } = params
  const phoneSuffix = last10Digits(phone)
  if (!phoneSuffix) return

  const { data: progress } = await service
    .from('lead_qualifying_progress')
    .select('id, lead_id, question_index, answers')
    .eq('store_id', storeId)
    .eq('phone', phoneSuffix)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (progress) {
    await continueFlow(service, storeId, phone, progress as {
      id: string; lead_id: string; question_index: number; answers: unknown
    }, text)
    return
  }

  await maybeStartFlow(service, storeId, phone, phoneSuffix, text)
}

async function maybeStartFlow(
  service: ServiceClient,
  storeId: string,
  phone: string,
  phoneSuffix: string,
  firstReplyText: string,
): Promise<void> {
  const { data: leads } = await service
    .from('leads')
    .select('id, form_id, phone')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(500)

  const lead = (leads ?? []).find(l => last10Digits((l.phone as string) ?? '') === phoneSuffix)
  if (!lead?.form_id) return

  // Don't restart a flow that already ran (in progress or completed) for this lead.
  const { data: existing } = await service
    .from('lead_qualifying_progress')
    .select('id')
    .eq('lead_id', lead.id as string)
    .maybeSingle()
  if (existing) return

  const { data: auto } = await service
    .from('lead_form_automations')
    .select('qualifying_questions')
    .eq('store_id', storeId)
    .eq('form_id', lead.form_id as string)
    .maybeSingle()

  const questions = (auto?.qualifying_questions as string[] | null) ?? []
  if (!questions.length) return

  const sendResult = await sendWhatsAppMessage({ to: phone, message: questions[0] })
  if (!sendResult.success) {
    console.error('[Qualifying flow] failed to send first question:', sendResult.error)
    return
  }

  await service.from('lead_qualifying_progress').insert({
    lead_id: lead.id as string,
    store_id: storeId,
    phone: phoneSuffix,
    question_index: 0,
    answers: [],
    status: 'in_progress',
  })
  // The lead's very first reply just triggered the first question — it wasn't
  // an answer to anything, so firstReplyText is intentionally not saved.
  void firstReplyText
}

async function continueFlow(
  service: ServiceClient,
  storeId: string,
  phone: string,
  progress: { id: string; lead_id: string; question_index: number; answers: unknown },
  answerText: string,
): Promise<void> {
  const { data: lead } = await service
    .from('leads')
    .select('form_id, fields')
    .eq('id', progress.lead_id)
    .maybeSingle()
  if (!lead?.form_id) return

  const { data: auto } = await service
    .from('lead_form_automations')
    .select('qualifying_questions')
    .eq('store_id', storeId)
    .eq('form_id', lead.form_id as string)
    .maybeSingle()

  const questions = (auto?.qualifying_questions as string[] | null) ?? []
  const askedIndex = progress.question_index
  const askedQuestion = questions[askedIndex]
  if (!askedQuestion) return

  const answers = Array.isArray(progress.answers) ? [...(progress.answers as unknown[])] : []
  answers[askedIndex] = { question: askedQuestion, answer: answerText }

  // Surface the answer on the lead itself, alongside its other custom fields —
  // no separate UI needed to see what was collected.
  const existingFields = (lead.fields as Record<string, string> | null) ?? {}
  await service.from('leads').update({
    fields: { ...existingFields, [askedQuestion]: answerText },
  }).eq('id', progress.lead_id)

  const nextIndex = askedIndex + 1
  if (nextIndex < questions.length) {
    const sendResult = await sendWhatsAppMessage({ to: phone, message: questions[nextIndex] })
    if (!sendResult.success) {
      console.error('[Qualifying flow] failed to send next question:', sendResult.error)
      return
    }
    await service.from('lead_qualifying_progress').update({
      question_index: nextIndex,
      answers,
      updated_at: new Date().toISOString(),
    }).eq('id', progress.id)
  } else {
    await sendWhatsAppMessage({ to: phone, message: CLOSING_MESSAGE })
    await service.from('lead_qualifying_progress').update({
      answers,
      status: 'completed',
      updated_at: new Date().toISOString(),
    }).eq('id', progress.id)
  }
}

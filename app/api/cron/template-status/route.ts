import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export const maxDuration = 60

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.wapaci.com'
const FROM_EMAIL = 'Wapaci <notifications@wapaci.com>'

async function sendStatusEmail(
  to: string,
  templateName: string,
  status: string,
  reason?: string,
) {
  if (!resend) return
  const approved = status === 'APPROVED'

  const subject = approved
    ? `✅ Your template "${templateName}" is approved`
    : `❌ Your template "${templateName}" was rejected by Meta`

  const html = approved
    ? `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#25D366;color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <p style="margin:0;font-size:22px;font-weight:700">✅ Template Approved!</p>
        </div>
        <p style="color:#374151;font-size:15px">Your WhatsApp template <strong>${templateName}</strong> has been approved by Meta and is ready to use.</p>
        <p style="color:#374151;font-size:15px">You can now select it in your lead form settings to automatically message new leads.</p>
        <a href="${APP_URL}/dashboard/templates" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:14px;margin-top:8px">
          Go to Templates →
        </a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">Wapaci — WhatsApp Revenue Automation</p>
      </div>`
    : `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#EF4444;color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <p style="margin:0;font-size:22px;font-weight:700">❌ Template Rejected</p>
        </div>
        <p style="color:#374151;font-size:15px">Your WhatsApp template <strong>${templateName}</strong> was rejected by Meta.</p>
        ${reason ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 16px;margin:16px 0"><p style="margin:0;color:#991B1B;font-size:13px"><strong>Reason:</strong> ${reason}</p></div>` : ''}
        <p style="color:#374151;font-size:14px">Common reasons: promotional language, missing opt-out, unclear variables. Edit the template and resubmit.</p>
        <a href="${APP_URL}/dashboard/templates" style="display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:14px;margin-top:8px">
          Edit &amp; Resubmit →
        </a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">Wapaci — WhatsApp Revenue Automation</p>
      </div>`

  await resend.emails.send({ from: FROM_EMAIL, to, subject, html }).catch(e =>
    console.warn('[TemplateStatus cron] email failed:', e)
  )
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // All pending custom templates across all users
  const { data: pending } = await supabase
    .from('templates')
    .select('id, name, meta_status, meta_template_name, user_id')
    .eq('meta_status', 'PENDING')
    .not('meta_template_name', 'is', null)

  if (!pending?.length) {
    return NextResponse.json({ checked: 0, updated: 0 })
  }

  // Group by user so we make one Meta API call per WABA
  const byUser: Record<string, typeof pending> = {}
  for (const t of pending) {
    if (!byUser[t.user_id]) byUser[t.user_id] = []
    byUser[t.user_id].push(t)
  }

  let updated = 0

  for (const [userId, templates] of Object.entries(byUser)) {
    const { data: wa } = await supabase
      .from('whatsapp_accounts')
      .select('waba_id, access_token')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .maybeSingle()

    if (!wa?.waba_id) continue

    // Get user email via admin API (service role has access)
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    const userEmail = user?.email

    const token = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? (wa.access_token as string)
    const names = templates.map(t => t.meta_template_name).join(',')

    let metaRows: { name: string; status: string; rejected_reason?: string }[] = []
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${wa.waba_id}/message_templates?fields=name,status,rejected_reason&limit=50&name=${encodeURIComponent(names)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const d = await res.json() as { data?: typeof metaRows }
      metaRows = d.data ?? []
    } catch (e) {
      console.warn(`[TemplateStatus cron] Meta fetch failed for user ${userId}:`, e)
      continue
    }

    const statusMap: Record<string, { status: string; reason?: string }> = {}
    for (const r of metaRows) statusMap[r.name] = { status: r.status, reason: r.rejected_reason }

    for (const tmpl of templates) {
      const meta = statusMap[tmpl.meta_template_name as string]
      if (!meta || meta.status === 'PENDING') continue

      await supabase.from('templates').update({
        meta_status: meta.status,
        updated_at:  new Date().toISOString(),
      }).eq('id', tmpl.id)

      updated++
      console.log(`[TemplateStatus cron] ${tmpl.name} → ${meta.status} (user ${userId})`)

      if (userEmail) {
        await sendStatusEmail(userEmail, tmpl.name as string, meta.status, meta.reason)
      }
    }
  }

  return NextResponse.json({ checked: pending.length, updated })
}

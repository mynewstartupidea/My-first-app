import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

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

      const approved = meta.status === 'APPROVED'

      // Update template status in DB
      await supabase.from('templates').update({
        meta_status: meta.status,
        updated_at:  new Date().toISOString(),
      }).eq('id', tmpl.id)

      // Insert in-app notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type:    approved ? 'template_approved' : 'template_rejected',
        title:   approved
          ? `"${tmpl.name}" approved ✅`
          : `"${tmpl.name}" rejected ❌`,
        body: approved
          ? 'Your WhatsApp template is ready to use in your lead forms.'
          : meta.reason
            ? `Reason: ${meta.reason}`
            : 'Edit and resubmit your template.',
        link: '/dashboard/templates',
      })

      updated++
      console.log(`[TemplateStatus cron] ${tmpl.name} → ${meta.status} (user ${userId})`)
    }
  }

  return NextResponse.json({ checked: pending.length, updated })
}

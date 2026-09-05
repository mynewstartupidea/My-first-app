import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/leads/[id]/conversation-status
// Returns: { missedCallFollowupEnabled, waSentRecently, waStatus }
// Used by CallLogModal to smart-check the follow-up checkbox and show warnings.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const [leadRes, profileRes] = await Promise.all([
    service.from('leads').select('phone, wa_status').eq('id', id).maybeSingle(),
    service.from('user_profiles').select('missed_call_followup_enabled').eq('id', user.id).maybeSingle(),
  ])

  const lead    = leadRes.data
  const profile = profileRes.data
  const missedCallFollowupEnabled = profile?.missed_call_followup_enabled ?? false

  if (!lead?.phone) {
    return NextResponse.json({
      missedCallFollowupEnabled,
      waSentRecently: false,
      waStatus: lead?.wa_status ?? null,
    })
  }

  // Check if any WhatsApp job was sent/queued to this phone in the last 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { data: recentJobs } = await service
    .from('automation_jobs')
    .select('id')
    .eq('customer_phone', lead.phone)
    .in('status', ['sent', 'pending'])
    .gte('scheduled_at', fourHoursAgo)
    .limit(1)

  return NextResponse.json({
    missedCallFollowupEnabled,
    waSentRecently: (recentJobs?.length ?? 0) > 0,
    waStatus: lead.wa_status,
  })
}

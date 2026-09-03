import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Returns which Facebook page(s) have already had WhatsApp messages sent to their leads.
// Used by the campaign modal to lock the page selector once a page is committed.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Find all form_ids that have had a WhatsApp message sent or queued
  const { data: sentLeads } = await service
    .from('leads')
    .select('form_id')
    .eq('user_id', user.id)
    .in('wa_status', ['sent', 'pending'])
    .not('form_id', 'is', null)

  const formIds = [...new Set((sentLeads ?? []).map(l => l.form_id as string).filter(Boolean))]
  if (!formIds.length) return NextResponse.json({ locked_pages: [] })

  // Trace form_id → connection_id
  const { data: automations } = await service
    .from('lead_form_automations')
    .select('connection_id')
    .eq('user_id', user.id)
    .in('form_id', formIds)

  const connIds = [...new Set((automations ?? []).map(a => a.connection_id as string).filter(Boolean))]
  if (!connIds.length) return NextResponse.json({ locked_pages: [] })

  // Trace connection_id → page_id + page_name
  const { data: connections } = await service
    .from('facebook_connections')
    .select('page_id, page_name')
    .eq('user_id', user.id)
    .in('id', connIds)

  return NextResponse.json({
    locked_pages: (connections ?? []).map(c => ({
      page_id:   c.page_id as string,
      page_name: c.page_name as string,
    })),
  })
}

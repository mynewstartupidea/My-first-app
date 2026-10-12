import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLeadForms } from '@/lib/facebook'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { resolveManagedOrg } from '@/lib/resolve-managed-org'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: allConnections } = await service
    .from('facebook_connections')
    .select('id, page_id, page_name, store_id, subscribed_to_leadgen, page_access_token, user_access_token, selection_status')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true })

  const connections = (allConnections ?? []).filter(c => c.selection_status !== 'pending')
  const pendingConnections = (allConnections ?? []).filter(c => c.selection_status === 'pending')

  // With page_id: return forms for that page (called from "Activate a form" modal)
  if (pageId) {
    const conn = (connections ?? []).find(c => c.page_id === pageId)
    if (!conn) return NextResponse.json({ forms: [], connectionId: null, whatsapp_connected: false })

    const [forms, waRow] = await Promise.all([
      getLeadForms(conn.page_id as string, conn.page_access_token as string, conn.user_access_token as string | null),
      service.from('whatsapp_accounts').select('id').eq('user_id', ownerId).eq('status', 'connected').maybeSingle(),
    ])

    return NextResponse.json({ forms, connectionId: conn.id, whatsapp_connected: !!waRow.data })
  }

  // Without page_id: return just the page list.
  // Also backfill lead_form_automations for any connection that has no forms
  // registered yet — so leads sync immediately without needing to activate first.
  const pages = (connections ?? []).map(conn => ({
    id:                    conn.id,
    page_id:               conn.page_id,
    page_name:             conn.page_name,
    store_id:              conn.store_id,
    subscribed_to_leadgen: conn.subscribed_to_leadgen,
  }))

  // Check which connections have no forms registered
  const connIds = (connections ?? []).map(c => c.id as string)
  if (connIds.length > 0) {
    const { data: existingForms } = await service
      .from('lead_form_automations')
      .select('connection_id')
      .eq('user_id', ownerId)
      .in('connection_id', connIds)

    const connIdsWithForms = new Set((existingForms ?? []).map(f => f.connection_id as string))
    const connsWithoutForms = (connections ?? []).filter(c => !connIdsWithForms.has(c.id as string))

    // Backfill forms for connections that have none — awaited so it completes before response
    if (connsWithoutForms.length > 0) {
      await Promise.all(connsWithoutForms.map(async conn => {
        try {
          const forms = await getLeadForms(
            conn.page_id as string,
            conn.page_access_token as string,
            conn.user_access_token as string | null,
          )
          if (!forms.length) return

          const rows = forms.map(f => ({
            user_id:          ownerId,
            store_id:         conn.store_id ?? null,
            connection_id:    conn.id,
            form_id:          f.id,
            form_name:        f.name,
            message_template: '',
            is_enabled:       false,
            updated_at:       new Date().toISOString(),
          }))

          await service
            .from('lead_form_automations')
            .upsert(rows, { onConflict: 'user_id,form_id', ignoreDuplicates: true })
        } catch { /* non-fatal */ }
      }))
    }
  }

  const pending = pendingConnections.map(conn => ({
    id:        conn.id,
    page_id:   conn.page_id,
    page_name: conn.page_name,
  }))

  return NextResponse.json({ pages, pending })
}

// Cancels any still-pending (not yet sent) Lead Ad Response jobs for leads
// from the page(s) being disconnected — without this, a message already
// queued in the brief window before a disconnect would still go out
// afterward, which is exactly the kind of cross-page/cross-business send
// that shouldn't happen. Pending lead_ad jobs are always a small set (only
// genuinely new leads ever get one queued, never a historical backlog), so
// this fetches them all for the owner's store(s) and cross-references
// against leads.page_id in JS, rather than trying to filter a JSONB path
// against what could be a large lead-id list.
async function cancelPendingLeadAdJobsForPages(
  service: ReturnType<typeof createServiceClient>, ownerId: string, pageIds: string[],
): Promise<void> {
  if (!pageIds.length) return
  const { data: stores } = await service.from('stores').select('id').eq('user_id', ownerId)
  const storeIds = (stores ?? []).map(s => s.id as string)
  if (!storeIds.length) return

  const { data: jobs } = await service.from('automation_jobs')
    .select('id, context')
    .in('store_id', storeIds)
    .eq('type', 'lead_ad')
    .eq('status', 'pending')
  const pending = (jobs ?? [])
    .map(j => ({ id: j.id as string, leadId: (j.context as Record<string, unknown> | null)?.lead_id as string | undefined }))
    .filter((j): j is { id: string; leadId: string } => !!j.leadId)
  if (!pending.length) return

  const { data: leads } = await service.from('leads').select('id, page_id').in('id', pending.map(j => j.leadId))
  const leadToPage = new Map((leads ?? []).map(l => [l.id as string, l.page_id as string | null]))
  const pageIdSet = new Set(pageIds)
  const jobIdsToCancel = pending.filter(j => {
    const pid = leadToPage.get(j.leadId)
    return pid && pageIdSet.has(pid)
  }).map(j => j.id)

  if (jobIdsToCancel.length) {
    await service.from('automation_jobs').update({ status: 'cancelled' }).in('id', jobIdsToCancel)
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Disconnecting is destructive (kills lead sync org-wide) — restrict to
  // owner/admin, same bar as other org-management actions, rather than
  // extending it to every role the way the read-only lookups above are.
  const { data: membership } = await service
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (membership && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only the owner or an admin can disconnect Facebook pages.' }, { status: 403 })
  }

  const org = await resolveManagedOrg(service, user.id, user.email ?? '')
  const ownerId = (org?.owner_id as string | undefined) ?? user.id

  const body = await request.json() as { pageId?: string; all?: boolean }

  if (body.all) {
    const { data: conns } = await service.from('facebook_connections').select('page_id').eq('user_id', ownerId)
    await cancelPendingLeadAdJobsForPages(service, ownerId, (conns ?? []).map(c => c.page_id as string))
    await service.from('facebook_connections').delete().eq('user_id', ownerId)
    await service.from('lead_form_automations').delete().eq('user_id', ownerId)
  } else if (body.pageId) {
    const { data: conn } = await service
      .from('facebook_connections')
      .select('id')
      .eq('user_id', ownerId)
      .eq('page_id', body.pageId)
      .maybeSingle()
    if (conn) {
      await cancelPendingLeadAdJobsForPages(service, ownerId, [body.pageId])
      await service.from('facebook_connections').delete().eq('id', conn.id)
      await service.from('lead_form_automations').delete().eq('connection_id', conn.id)
    }
  }

  return NextResponse.json({ ok: true })
}

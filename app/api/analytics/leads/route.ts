import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/analytics/leads?range=7d|30d|90d
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') ?? '30d'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const days    = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const fromDate = new Date(Date.now() - days * 86400000).toISOString()

  // Resolve org visibility (same pattern as leads API)
  let orgOwnerId: string | null = null
  let distMode = 'manual'
  const { data: memberRow } = await service
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (memberRow?.organization_id) {
    const { data: org } = await service
      .from('organizations')
      .select('owner_id, lead_distribution_mode')
      .eq('id', memberRow.organization_id)
      .maybeSingle()
    if (org) {
      orgOwnerId = org.owner_id
      distMode   = org.lead_distribution_mode ?? 'manual'
    }
  }

  const visibilityFilter = (orgOwnerId && distMode === 'open_pool')
    ? `user_id.eq.${user.id},assigned_to.eq.${user.id},and(user_id.eq.${orgOwnerId},assigned_to.is.null)`
    : `user_id.eq.${user.id},assigned_to.eq.${user.id}`

  const { data: leads } = await service
    .from('leads')
    .select('id,lead_status,wa_status,created_at,ad_name,adset_name,campaign_name,form_name,form_id')
    .or(visibilityFilter)
    .gte('created_at', fromDate)

  const all = leads ?? []

  // KPIs
  const total     = all.length
  const converted = all.filter(l => l.lead_status === 'converted').length
  const junk      = all.filter(l => l.lead_status === 'junk').length
  const lost      = all.filter(l => l.lead_status === 'lost').length
  const good      = all.filter(l => ['hot', 'warm', 'cold'].includes(l.lead_status ?? '')).length
  const closeRate = total > 0 ? Math.round((converted / total) * 100) : 0
  const junkRate  = total > 0 ? Math.round((junk / total) * 100) : 0
  const waSent    = all.filter(l => ['sent', 'pending'].includes(l.wa_status)).length

  // By status
  const STATUS_ORDER = ['hot', 'warm', 'cold', 'converted', 'lost', 'junk', 'resolved']
  const statusMap: Record<string, number> = {}
  for (const l of all) {
    const s = l.lead_status ?? 'untagged'
    statusMap[s] = (statusMap[s] ?? 0) + 1
  }
  const byStatus = [
    ...STATUS_ORDER.filter(s => statusMap[s]).map(s => ({ status: s, count: statusMap[s] })),
    ...(statusMap['untagged'] ? [{ status: 'untagged', count: statusMap['untagged'] }] : []),
  ]

  // Daily counts
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0]
    dailyMap[d] = 0
  }
  for (const l of all) {
    const d = (l.created_at as string).split('T')[0]
    if (d in dailyMap) dailyMap[d]++
  }
  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  // Ad attribution
  type AdEntry = { total: number; converted: number; junk: number; campaign_name: string | null; adset_name: string | null }
  const adMap: Record<string, AdEntry> = {}
  for (const l of all) {
    if (!l.ad_name) continue
    const key = l.ad_name as string
    if (!adMap[key]) adMap[key] = { total: 0, converted: 0, junk: 0, campaign_name: l.campaign_name ?? null, adset_name: l.adset_name ?? null }
    adMap[key].total++
    if (l.lead_status === 'converted') adMap[key].converted++
    if (l.lead_status === 'junk')      adMap[key].junk++
  }
  const byAd = Object.entries(adMap)
    .map(([ad_name, v]) => ({
      ad_name,
      campaign_name: v.campaign_name,
      adset_name:    v.adset_name,
      total:         v.total,
      converted:     v.converted,
      junk:          v.junk,
      close_rate:    v.total > 0 ? Math.round((v.converted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Form attribution
  type FormEntry = { form_name: string; total: number; converted: number; junk: number }
  const formMap: Record<string, FormEntry> = {}
  for (const l of all) {
    const key = (l.form_id as string) ?? 'unknown'
    if (!formMap[key]) formMap[key] = { form_name: (l.form_name as string) ?? key, total: 0, converted: 0, junk: 0 }
    formMap[key].total++
    if (l.lead_status === 'converted') formMap[key].converted++
    if (l.lead_status === 'junk')      formMap[key].junk++
  }
  const byForm = Object.values(formMap)
    .map(f => ({ ...f, close_rate: f.total > 0 ? Math.round((f.converted / f.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({
    kpis: { total, converted, junk, lost, good, closeRate, junkRate, waSent },
    daily,
    byStatus,
    byAd,
    byForm,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// POST /api/campaigns/send — execute a campaign immediately
// Body: { campaign_id: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaign_id } = await req.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  // Fetch campaign (RLS ensures ownership)
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns').select('*').eq('id', campaign_id).single()
  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'running' || campaign.status === 'completed') {
    return NextResponse.json({ error: 'Campaign already running or completed' }, { status: 400 })
  }

  // Fetch store for WhatsApp config
  const { data: store } = await supabase
    .from('stores').select('*').eq('id', campaign.store_id).single()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Fetch audience
  let query = supabase
    .from('customers')
    .select('id, phone, name')
    .eq('store_id', store.id)
    .eq('whatsapp_opt_in', true)

  if (campaign.audience === 'inactive_30') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  } else if (campaign.audience === 'inactive_60') {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  } else if (campaign.audience === 'inactive_90') {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  }
  // 'all' and 'opted_in' → already filtered to whatsapp_opt_in = true

  const { data: customers } = await query.limit(1000)
  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: 'No eligible customers in this audience segment' }, { status: 400 })
  }

  // Mark campaign as running
  await supabase.from('campaigns').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', campaign_id)

  let sentCount = 0
  let failedCount = 0

  // Send messages (in small batches to avoid timeouts)
  for (const customer of customers) {
    const personalizedMessage = campaign.message
      .replace(/\{\{name\}\}/g, customer.name ?? 'there')

    const result = await sendWhatsAppMessage({
      to:     customer.phone,
      message: personalizedMessage,
      bsp:    store.whatsapp_bsp,
      apiKey: store.whatsapp_api_key ?? undefined,
    })

    if (result.success) {
      sentCount++
      // Log the message
      await supabase.from('messages').insert({
        store_id:       store.id,
        customer_phone: customer.phone,
        customer_name:  customer.name,
        type:           'broadcast',
        message:        personalizedMessage,
        status:         'sent',
        bsp_message_id: result.messageId,
      })
    } else {
      failedCount++
    }
  }

  // Update campaign status
  await supabase.from('campaigns').update({
    status:      'completed',
    sent_count:  sentCount,
    failed_count: failedCount,
    updated_at:  new Date().toISOString(),
  }).eq('id', campaign_id)

  return NextResponse.json({ success: true, sentCount, failedCount })
}

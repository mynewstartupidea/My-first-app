import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const FB_BASE = 'https://graph.facebook.com/v21.0'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: connections } = await service
    .from('facebook_connections')
    .select('page_id, page_name, page_access_token, user_access_token')
    .eq('user_id', user.id)
    .limit(3) // just first 3 pages for debug

  const results = await Promise.all(
    (connections ?? []).map(async conn => {
      const tryToken = async (token: string, label: string) => {
        const url = `${FB_BASE}/${conn.page_id}/leadgen_forms?access_token=${token}&fields=id,name,status&limit=10`
        const res  = await fetch(url)
        const json = await res.json()
        return { label, status: res.status, response: json }
      }

      const pageResult = await tryToken(conn.page_access_token, 'page_token')
      const userResult = conn.user_access_token
        ? await tryToken(conn.user_access_token, 'user_token')
        : null

      // Also check token info
      const tokenInfo = await fetch(
        `${FB_BASE}/debug_token?input_token=${conn.page_access_token}&access_token=${conn.page_access_token}`
      ).then(r => r.json()).catch(() => null)

      return {
        page: conn.page_name,
        page_id: conn.page_id,
        has_user_token: !!conn.user_access_token,
        page_token_result: pageResult,
        user_token_result: userResult,
        token_debug: tokenInfo,
      }
    })
  )

  return NextResponse.json({ results })
}

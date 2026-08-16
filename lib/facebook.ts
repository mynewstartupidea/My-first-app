const FB_API_VERSION = 'v21.0'
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`

export interface FBPage {
  id: string
  name: string
  access_token: string
}

export interface FBLeadForm {
  id: string
  name: string
  status: string
}

export interface FBLead {
  id: string
  created_time: string
  field_data: { name: string; values: string[] }[]
}

// Reuses META_APP_ID / META_APP_SECRET already set in Vercel
function appId()     { return process.env.META_APP_ID! }
function appSecret() { return process.env.META_APP_SECRET! }
function appUrl()    { return process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.wapaci.com' }
function redirectUri() { return `${appUrl()}/api/facebook/callback` }

export function getFacebookOAuthUrl(state: string, callbackUrl?: string): string {
  const scopes = 'pages_show_list,leads_retrieval,pages_manage_ads'
  return (
    `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?` +
    new URLSearchParams({ client_id: appId(), redirect_uri: callbackUrl ?? redirectUri(), scope: scopes, state, response_type: 'code' })
  )
}

export async function exchangeFBCode(code: string, callbackUrl?: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId(), client_secret: appSecret(), redirect_uri: callbackUrl ?? redirectUri(), code,
  })
  const res = await fetch(`${FB_BASE}/oauth/access_token?${params}`)
  if (!res.ok) throw new Error(`FB code exchange failed: ${await res.text()}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getLongLivedToken(shortToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token', client_id: appId(), client_secret: appSecret(),
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${FB_BASE}/oauth/access_token?${params}`)
  if (!res.ok) throw new Error(`Long-lived token failed: ${await res.text()}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getUserPages(userToken: string): Promise<FBPage[]> {
  const res = await fetch(`${FB_BASE}/me/accounts?access_token=${userToken}&fields=id,name,access_token`)
  if (!res.ok) return []
  const data = await res.json() as { data?: FBPage[] }
  return data.data ?? []
}

export async function subscribePageToLeadgen(pageId: string, pageToken: string): Promise<boolean> {
  const res = await fetch(
    `${FB_BASE}/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageToken}`,
    { method: 'POST' }
  )
  return res.ok
}

export async function getLeadForms(pageId: string, pageToken: string, userToken?: string | null): Promise<FBLeadForm[]> {
  const tryFetch = async (token: string) => {
    const url = `${FB_BASE}/${pageId}/leadgen_forms?access_token=${token}&fields=id,name,status&limit=100`
    const res  = await fetch(url)
    const json = await res.json() as { data?: FBLeadForm[]; error?: { message: string; code: number } }
    if (!res.ok || json.error) return { ok: false, error: json.error, data: [] as FBLeadForm[] }
    return { ok: true, error: null, data: json.data ?? [] }
  }

  const result = await tryFetch(pageToken)
  if (result.ok) return result.data

  console.error(`[FB] getLeadForms page ${pageId} (page token):`, result.error)

  // Fallback to user token if available
  if (userToken) {
    const fallback = await tryFetch(userToken)
    if (fallback.ok) return fallback.data
    console.error(`[FB] getLeadForms page ${pageId} (user token fallback):`, fallback.error)
  }

  return []
}

export async function getFormLeads(
  formId: string,
  pageToken: string,
  since?: string | null,
  limit = 100,
  until?: string | null,
): Promise<FBLead[]> {
  let url = `${FB_BASE}/${formId}/leads?access_token=${pageToken}&fields=id,created_time,field_data&limit=${limit}`
  const filters: object[] = []
  if (since) filters.push({ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(since).getTime() / 1000) })
  if (until) filters.push({ field: 'time_created', operator: 'LESS_THAN',    value: Math.floor(new Date(until).getTime() / 1000) })
  if (filters.length) url += `&filtering=${encodeURIComponent(JSON.stringify(filters))}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { data?: FBLead[] }
  return data.data ?? []
}

export async function getFBLead(leadId: string, pageToken: string): Promise<FBLead | null> {
  const res = await fetch(`${FB_BASE}/${leadId}?access_token=${pageToken}&fields=id,created_time,field_data`)
  if (!res.ok) return null
  return res.json() as Promise<FBLead>
}

export function extractAllFields(fieldData: { name: string; values: string[] }[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const f of fieldData ?? []) {
    if (f.values?.[0]) result[f.name] = f.values[0]
  }
  return result
}

export function parseLeadFields(fieldData: { name: string; values: string[] }[]): {
  name: string | null
  email: string | null
  phone: string | null
} {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const f = fieldData.find(f => f.name.toLowerCase().replace(/[_\s]/g, '').includes(key))
      if (f?.values?.[0]) return f.values[0]
    }
    return null
  }
  const first = get('firstname')
  const last  = get('lastname')
  const full  = get('fullname', 'name')
  return {
    name:  full ?? (first && last ? `${first} ${last}` : first ?? last),
    email: get('email'),
    phone: get('phone', 'phonenumber', 'mobile'),
  }
}

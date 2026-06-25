import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Normalize a raw phone string to 10-digit Indian mobile, or null
function normalizePhone(raw: string): string | null {
  if (!raw) return null
  // Strip leading apostrophe/backtick (Excel text-prefix trick) and whitespace
  const clean = raw.replace(/^[''"`\s]+/, '').trim()
  // Remove formatting chars, keep only digits
  const digits = clean.replace(/[\s\-\.\(\)\/\\+]/g, '').replace(/\D/g, '')

  let ten: string | null = null
  if (digits.length === 10) ten = digits
  else if (digits.length === 12 && digits.startsWith('91')) ten = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) ten = digits.slice(1)
  else if (digits.length === 13 && digits.startsWith('091')) ten = digits.slice(3)

  // Valid Indian mobile: starts with 6-9
  if (ten && /^[6-9]\d{9}$/.test(ten)) return ten
  return null
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"' && !inQuotes) { inQuotes = true; continue }
    if (ch === '"' && inQuotes) { inQuotes = false; continue }
    if (ch === delimiter && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

interface ParsedContact { phone: string; name?: string }

function parseFileContent(content: string, filename: string): ParsedContact[] {
  const seen = new Map<string, string | undefined>() // phone -> name

  const ext = filename.toLowerCase().split('.').pop() ?? ''

  // VCF / vCard
  if (ext === 'vcf') {
    const cards = content.split(/BEGIN:VCARD/i)
    for (const card of cards) {
      const fnMatch = card.match(/^FN[^:]*:(.*)/im)
      const name = fnMatch?.[1]?.trim().replace(/\\n/g, ' ')
      for (const m of card.matchAll(/^TEL[^:]*:(.*)/gim)) {
        const phone = normalizePhone(m[1].trim())
        if (phone && !seen.has(phone)) seen.set(phone, name)
      }
    }
    return [...seen.entries()].map(([phone, name]) => ({ phone, name }))
  }

  const lines = content.split(/\r?\n/)
  const isCSV = content.includes(',') || content.includes('\t')
  const delimiter = content.includes('\t') ? '\t' : ','

  // Try to detect header row and phone/name columns
  let phoneCol = -1
  let nameCol = -1
  let startLine = 0

  if (isCSV && lines.length > 1) {
    const headers = splitCSVLine(lines[0] ?? '', delimiter)
      .map(h => h.replace(/["']/g, '').trim().toLowerCase())
    const phoneIdx = headers.findIndex(h => /phone|mobile|contact|whatsapp|tel|number|mob/.test(h))
    const nameIdx  = headers.findIndex(h => /name|customer|client|person|contact_name/.test(h))
    if (phoneIdx >= 0) { phoneCol = phoneIdx; nameCol = nameIdx; startLine = 1 }
  }

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (isCSV) {
      const cells = splitCSVLine(line, delimiter)

      if (phoneCol >= 0) {
        const raw = cells[phoneCol]?.replace(/["']/g, '').trim() ?? ''
        const phone = normalizePhone(raw)
        if (phone && !seen.has(phone)) {
          const name = nameCol >= 0 ? cells[nameCol]?.replace(/["']/g, '').trim() || undefined : undefined
          seen.set(phone, name)
        }
      } else {
        // No header detected — scan every cell
        for (const cell of cells) {
          const phone = normalizePhone(cell.replace(/["']/g, '').trim())
          if (phone && !seen.has(phone)) seen.set(phone, undefined)
        }
      }
    } else {
      // Plain text — try whole line and also embedded 10-digit patterns
      const phone = normalizePhone(line)
      if (phone && !seen.has(phone)) { seen.set(phone, undefined); continue }

      // Fallback: grep embedded Indian numbers from the line
      for (const match of line.matchAll(/[6-9]\d{9}/g)) {
        if (!seen.has(match[0])) seen.set(match[0], undefined)
      }
    }
  }

  return [...seen.entries()].map(([phone, name]) => ({ phone, name }))
}

async function checkWhatsAppBatch(phones: string[], token: string, phoneId: string): Promise<Set<string>> {
  const valid = new Set<string>()
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocking: 'wait',
        contacts: phones.map(p => `+91${p}`),
        force_check: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json() as { error?: { code?: number; message?: string } }
      console.error('[upload] WA contacts API error', err)
      return valid
    }

    const data = await res.json() as {
      contacts?: { input: string; status: string; wa_id?: string }[]
    }
    for (const c of data.contacts ?? []) {
      if (c.status === 'valid') {
        const ten = (c.wa_id ?? c.input.replace(/\D/g, '')).slice(-10)
        if (/^[6-9]\d{9}$/.test(ten)) valid.add(ten)
      }
    }
  } catch (err) {
    console.error('[upload] WA contacts fetch error', err)
  }
  return valid
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { content?: string; filename?: string }
  if (!body.content || !body.filename) {
    return NextResponse.json({ error: 'content and filename are required' }, { status: 400 })
  }

  // Get or create store — same ordering as /api/contacts GET so they always use the same store
  let { data: storeRow } = await supabase
    .from('stores').select('id').eq('user_id', user.id).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  let store = storeRow

  if (!store) {
    const { data: newStore, error: storeErr } = await supabase
      .from('stores')
      .insert({ user_id: user.id, shop_name: 'My Business', is_active: true })
      .select('id').single()
    if (storeErr || !newStore) {
      return NextResponse.json({ error: 'Could not find or create a store for this account' }, { status: 500 })
    }
    store = newStore
  }

  // Parse contacts from file
  const contacts = parseFileContent(body.content, body.filename)
  const uniquePhones = [...new Set(contacts.map(c => c.phone))]

  // Get WhatsApp credentials
  const service = createServiceClient()
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token')
    .eq('user_id', user.id)
    .maybeSingle()

  const token   = wa?.access_token ?? process.env.META_ACCESS_TOKEN
  const phoneId = wa?.phone_number_id ?? process.env.META_PHONE_NUMBER_ID

  let whatsappSet = new Set<string>()
  let whatsappChecked = false

  if (token && phoneId && uniquePhones.length > 0) {
    const BATCH = 50
    for (let i = 0; i < uniquePhones.length; i += BATCH) {
      const batch = uniquePhones.slice(i, i + BATCH)
      const result = await checkWhatsAppBatch(batch, token, phoneId)
      result.forEach(n => whatsappSet.add(n))
    }
    whatsappChecked = true
  } else {
    // No credentials — add all valid Indian numbers (WhatsApp check skipped)
    uniquePhones.forEach(p => whatsappSet.add(p))
  }

  // Build upsert payload — match phone to name from contacts list
  const phoneToName = new Map(contacts.map(c => [c.phone, c.name]))
  const toInsert = [...whatsappSet].map(phone => ({
    store_id: store!.id,
    phone: `+91${phone}`,
    name: phoneToName.get(phone) ?? null,
    whatsapp_opt_in: true,
    total_orders: 0,
    total_spent: 0,
  }))

  let saved = 0
  let skipped = 0

  if (toInsert.length > 0) {
    // Count existing contacts before insert so we can compute saved/skipped accurately.
    // Supabase's upsert with ignoreDuplicates:true uses ON CONFLICT DO NOTHING,
    // which can return 0 rows even when rows were inserted in some PostgREST versions.
    const phones = toInsert.map(r => r.phone)
    const { data: existing } = await supabase
      .from('customers')
      .select('phone')
      .eq('store_id', store!.id)
      .in('phone', phones)
    skipped = existing?.length ?? 0

    const { error: upsertError } = await supabase
      .from('customers')
      .upsert(toInsert, { onConflict: 'store_id,phone', ignoreDuplicates: true })
    if (upsertError) {
      console.error('[contacts/upload] upsert error:', upsertError.message, 'store_id:', store!.id)
      return NextResponse.json({ error: 'Failed to save contacts: ' + upsertError.message }, { status: 500 })
    }
    saved = toInsert.length - skipped
  }

  console.log(`[contacts/upload] store=${store!.id} found=${contacts.length} valid=${uniquePhones.length} whatsapp=${whatsappSet.size} saved=${saved} skipped=${skipped}`)

  return NextResponse.json({
    found:            contacts.length,
    valid:            uniquePhones.length,
    whatsapp:         whatsappSet.size,
    saved,
    skipped,
    whatsapp_checked: whatsappChecked,
  })
}

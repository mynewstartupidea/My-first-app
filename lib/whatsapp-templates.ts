// Wapaci starter templates — automatically provisioned to every merchant's WABA
// when they connect WhatsApp via Embedded Signup.
//
// These templates are submitted to Meta and are typically auto-approved within
// minutes, so merchants can start sending immediately without waiting.
//
// Variable mapping: Wapaci uses {{name}}, {{phone}}, {{email}} (named).
// Meta templates use {{1}}, {{2}}, … (positional).
// The `vars` array defines which named variables map to which position.

export interface StarterTemplate {
  name:        string        // Meta template name (lowercase, underscores only)
  language:    string        // BCP-47 language code
  category:    'MARKETING' | 'UTILITY'
  description: string        // shown in the Wapaci UI picker
  body:        string        // exact Meta template body with {{1}}, {{2}}, …
  bodyPreview: string        // Wapaci-style preview with {{name}}, {{phone}}, …
  vars:        string[]      // named vars in positional order → maps to {{1}}, {{2}}, …
  example:     string[][]    // sample values for Meta review (body_text format)
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name:        'wapaci_lead_greeting',
    language:    'en',
    category:    'MARKETING',
    description: 'Simple greeting — works for any lead form',
    body:        'Hi {{1}}! 👋 Thanks for your interest. We\'ll be in touch soon. Reply here if you have any questions!',
    bodyPreview: 'Hi {{name}}! 👋 Thanks for your interest. We\'ll be in touch soon. Reply here if you have any questions!',
    vars:        ['name'],
    example:     [['John']],
  },
  {
    name:        'wapaci_lead_callback',
    language:    'en',
    category:    'MARKETING',
    description: 'Promises a callback on the lead\'s phone number',
    body:        'Hi {{1}}! We\'ll call you at {{2}} soon. If you\'d like to talk now, just reply to this message! 😊',
    bodyPreview: 'Hi {{name}}! We\'ll call you at {{phone}} soon. If you\'d like to talk now, just reply to this message! 😊',
    vars:        ['name', 'phone'],
    example:     [['John', '+91 98765 43210']],
  },
  {
    name:        'wapaci_lead_confirm',
    language:    'en',
    category:    'UTILITY',
    description: 'Utility confirmation — higher deliverability, lower cost',
    body:        'Hi {{1}}! We got your request. Someone from our team will reach out shortly. Reply here anytime!',
    bodyPreview: 'Hi {{name}}! We got your request. Someone from our team will reach out shortly. Reply here anytime!',
    vars:        ['name'],
    example:     [['John']],
  },
  {
    name:        'wapaci_lead_service',
    language:    'en',
    category:    'MARKETING',
    description: 'Mentions the business service category',
    body:        'Hi {{1}}! Thanks for your interest. We\'ll call {{2}} within 24 hours. Feel free to reply here if you have questions!',
    bodyPreview: 'Hi {{name}}! Thanks for your interest. We\'ll call {{phone}} within 24 hours. Feel free to reply here if you have questions!',
    vars:        ['name', 'phone'],
    example:     [['John', '+91 98765 43210']],
  },
  {
    name:        'wapaci_missed_call',
    language:    'en',
    category:    'UTILITY',
    description: 'Missed call follow-up — send after a No Answer to re-engage the lead',
    body:        'Hi {{1}}, we tried calling you. Feel free to reply here whenever you\'re free.',
    bodyPreview: 'Hi {{name}}, we tried calling you. Feel free to reply here whenever you\'re free.',
    vars:        ['name'],
    example:     [['John']],
  },
  {
    name:        'wapaci_voicemail_followup',
    language:    'en',
    category:    'UTILITY',
    description: 'Voicemail follow-up — send after leaving a voicemail to open a chat',
    body:        'Hi {{1}}, we left you a voicemail. You can also reply here anytime and we\'ll get back to you.',
    bodyPreview: 'Hi {{name}}, we left you a voicemail. You can also reply here anytime and we\'ll get back to you.',
    vars:        ['name'],
    example:     [['John']],
  },
]

export interface TemplateProvisionResult {
  name:    string
  status:  'submitted' | 'already_exists' | 'updated' | 'failed'
  error?:  string
}

// Submit all Wapaci starter templates to a merchant's WABA.
// Uses the system user token (permanent) when available; falls back to merchant token.
// Safe to call multiple times — existing templates are skipped gracefully.
export async function provisionStarterTemplates(
  wabaId:    string,
  token:     string,
): Promise<TemplateProvisionResult[]> {
  const results: TemplateProvisionResult[] = []

  for (const tmpl of STARTER_TEMPLATES) {
    try {
      const body = {
        name:       tmpl.name,
        language:   tmpl.language,
        category:   tmpl.category,
        components: [{
          type:    'BODY',
          text:    tmpl.body,
          example: { body_text: [tmpl.example[0]] },
        }],
      }

      const res  = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json() as { id?: string; status?: string; error?: { code: number; message: string } }

      if (res.ok && data.id) {
        results.push({ name: tmpl.name, status: 'submitted' })
        console.log(`[WA Templates] submitted ${tmpl.name} → id=${data.id} status=${data.status ?? 'unknown'}`)
      } else if (data.error?.code === 100 && data.error.message?.includes('already exists')) {
        results.push({ name: tmpl.name, status: 'already_exists' })
        console.log(`[WA Templates] ${tmpl.name} already exists — skipping`)
      } else {
        results.push({ name: tmpl.name, status: 'failed', error: data.error?.message ?? 'Unknown error' })
        console.warn(`[WA Templates] ${tmpl.name} failed:`, data.error)
      }
    } catch (e) {
      results.push({ name: tmpl.name, status: 'failed', error: String(e) })
      console.warn(`[WA Templates] ${tmpl.name} exception:`, e)
    }
  }

  return results
}

// Delete existing templates and re-submit with current body text.
// Use this when the template copy changes and you need Meta to re-review.
export async function updateStarterTemplates(
  wabaId: string,
  token:  string,
): Promise<TemplateProvisionResult[]> {
  const results: TemplateProvisionResult[] = []
  const base = 'https://graph.facebook.com/v21.0'
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  for (const tmpl of STARTER_TEMPLATES) {
    try {
      // Step 1: delete by name (removes all language variants)
      await fetch(`${base}/${wabaId}/message_templates?name=${tmpl.name}`, { method: 'DELETE', headers })

      // Step 2: re-submit with updated body
      const res  = await fetch(`${base}/${wabaId}/message_templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name:       tmpl.name,
          language:   tmpl.language,
          category:   tmpl.category,
          components: [{ type: 'BODY', text: tmpl.body, example: { body_text: [tmpl.example[0]] } }],
        }),
      })
      const data = await res.json() as { id?: string; error?: { code: number; message: string } }

      if (res.ok && data.id) {
        results.push({ name: tmpl.name, status: 'updated' })
        console.log(`[WA Templates] updated ${tmpl.name} → id=${data.id}`)
      } else {
        results.push({ name: tmpl.name, status: 'failed', error: data.error?.message ?? 'Unknown error' })
        console.warn(`[WA Templates] update failed for ${tmpl.name}:`, data.error)
      }
    } catch (e) {
      results.push({ name: tmpl.name, status: 'failed', error: String(e) })
      console.warn(`[WA Templates] update exception for ${tmpl.name}:`, e)
    }
  }

  return results
}

// Fetch approval status of all Wapaci starter templates for a WABA.
// Returns a map of template name → 'APPROVED' | 'PENDING' | 'REJECTED' | 'not_found'
export async function getTemplateStatuses(
  wabaId: string,
  token:  string,
): Promise<Record<string, string>> {
  try {
    const names  = STARTER_TEMPLATES.map(t => t.name).join(',')
    const url    = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status&limit=20&name=${names}`
    const res    = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data   = await res.json() as { data?: { name: string; status: string }[] }
    const result: Record<string, string> = {}
    for (const t of data.data ?? []) result[t.name] = t.status
    return result
  } catch {
    return {}
  }
}

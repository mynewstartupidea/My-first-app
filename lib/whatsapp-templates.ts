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
    body:        'Hi {{1}}! 👋 Thanks for your interest. Our team will be in touch with you shortly.',
    bodyPreview: 'Hi {{name}}! 👋 Thanks for your interest. Our team will be in touch with you shortly.',
    vars:        ['name'],
    example:     [['John']],
  },
  {
    name:        'wapaci_lead_callback',
    language:    'en',
    category:    'MARKETING',
    description: 'Promises a callback on the lead\'s phone number',
    body:        'Hi {{1}}! Thanks for filling out our form. We\'ll call you back at {{2}} within 24 hours.',
    bodyPreview: 'Hi {{name}}! Thanks for filling out our form. We\'ll call you back at {{phone}} within 24 hours.',
    vars:        ['name', 'phone'],
    example:     [['John', '+91 98765 43210']],
  },
  {
    name:        'wapaci_lead_confirm',
    language:    'en',
    category:    'UTILITY',
    description: 'Utility confirmation — higher deliverability, lower cost',
    body:        'Hi {{1}}, we received your request and will get back to you soon. Reply STOP to unsubscribe.',
    bodyPreview: 'Hi {{name}}, we received your request and will get back to you soon. Reply STOP to unsubscribe.',
    vars:        ['name'],
    example:     [['John']],
  },
  {
    name:        'wapaci_lead_service',
    language:    'en',
    category:    'MARKETING',
    description: 'Mentions the business service category',
    body:        'Hi {{1}}! Thanks for your interest in our services. We\'ll reach out to {{2}} within 24 hours to discuss your requirements.',
    bodyPreview: 'Hi {{name}}! Thanks for your interest in our services. We\'ll reach out to {{phone}} within 24 hours to discuss your requirements.',
    vars:        ['name', 'phone'],
    example:     [['John', '+91 98765 43210']],
  },
]

export interface TemplateProvisionResult {
  name:    string
  status:  'submitted' | 'already_exists' | 'failed'
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

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

  // ─── Ecommerce (Shopify) automations ────────────────────────────────────────
  // bodyPreview below must stay byte-identical to the matching defaultTemplate
  // in app/dashboard/automations/page.tsx (and, for abandoned_cart, the seed
  // text in create_default_automations) — ECOM_TEMPLATE_BY_TYPE and
  // app/api/automations/route.ts match a saved automation's `template` text
  // against this exact string to decide whether it's still the untouched
  // default (safe to send as this approved template) or merchant-edited
  // (falls back to free-form text, same safety rule the lead-gen template
  // picker enforces client-side by clearing wa_template_name on any edit).
  {
    name:        'wapaci_abandoned_cart',
    language:    'en',
    category:    'MARKETING',
    description: 'Abandoned cart recovery — nudge a customer back to checkout',
    body:        'Hi {{1}}! 👋 You left something in your cart at {{2}}. Your items are waiting — complete your purchase here: {{3}}',
    bodyPreview: 'Hi {{name}}! 👋 You left something in your cart at {{shop_name}}.\n\nYour items are waiting! Complete your purchase here:\n{{cart_url}}\n\nHurry — items may sell out!',
    vars:        ['name', 'shop_name', 'cart_url'],
    example:     [['John', "Priya's Boutique", 'yourstore.com/cart/abc123']],
  },
  {
    name:        'wapaci_cod_verification',
    language:    'en',
    category:    'UTILITY',
    description: 'COD order verification — confirm before dispatch to reduce RTO',
    body:        'Hi {{1}}! Your COD order #{{2}} for ₹{{3}} at {{4}} is confirmed. Please reply YES to confirm or NO to cancel before dispatch. Thank you!',
    bodyPreview: 'Hi {{name}}! 🛍️ Your COD order #{{order_number}} for ₹{{amount}} at {{shop_name}} is confirmed.\n\nPlease reply *YES* to confirm or *NO* to cancel before dispatch.\n\nThank you!',
    vars:        ['name', 'order_number', 'amount', 'shop_name'],
    example:     [['John', '1234', '1299', "Priya's Boutique"]],
  },
  {
    name:        'wapaci_order_confirmation',
    language:    'en',
    category:    'UTILITY',
    description: 'Order confirmation — instant WhatsApp receipt when an order is placed',
    body:        'Hi {{1}}! 🎉 Your order #{{2}} is confirmed at {{3}}. We will notify you once it ships. Track your order: {{4}}',
    bodyPreview: 'Hi {{name}}! 🎉 Your order #{{order_number}} is confirmed at {{shop_name}}.\n\nWe\'ll send you shipping details soon. Track your order:\n{{order_url}}\n\nThank you for shopping with us!',
    vars:        ['name', 'order_number', 'shop_name', 'order_url'],
    example:     [['John', '1234', "Priya's Boutique", 'yourstore.com/orders/1234']],
  },
  {
    name:        'wapaci_shipping_update',
    language:    'en',
    category:    'UTILITY',
    description: 'Shipping update — notify with tracking once an order is fulfilled',
    body:        'Hi {{1}}! 📦 Your order #{{2}} from {{3}} has been shipped! Track it here: {{4}}',
    bodyPreview: 'Hi {{name}}! 📦 Your order #{{order_number}} from {{shop_name}} has been shipped!\n\nTrack your delivery:\n{{tracking_url}}\n\nExpected delivery in 3–5 business days.',
    vars:        ['name', 'order_number', 'shop_name', 'tracking_url'],
    example:     [['John', '1234', "Priya's Boutique", 'track.link/xyz']],
  },
  {
    name:        'wapaci_post_purchase_upsell',
    language:    'en',
    category:    'MARKETING',
    description: 'Post-purchase upsell — suggested picks sent after fulfillment',
    body:        'Hi {{1}}! Thank you for your order at {{2}} ❤️. Customers who bought this also loved these picks — check them out on our store!',
    bodyPreview: 'Hi {{name}}! Thank you for your order at {{shop_name}} ❤️\n\nCustomers who bought this also loved these picks — check them out on our store!',
    vars:        ['name', 'shop_name'],
    example:     [['John', "Priya's Boutique"]],
  },
  {
    name:        'wapaci_review_request',
    language:    'en',
    category:    'UTILITY',
    description: 'Review request — ask for a review a few days after delivery',
    body:        'Hi {{1}}! Hope you are loving your purchase from {{2}} 😊. Would you mind leaving us a quick review? It takes just 2 minutes and really helps us!',
    bodyPreview: 'Hi {{name}}! Hope you\'re loving your purchase from {{shop_name}} 😊\n\nWould you mind leaving us a quick review? It helps us a lot and takes just 2 minutes!\n\nThank you!',
    vars:        ['name', 'shop_name'],
    example:     [['John', "Priya's Boutique"]],
  },
]

// Maps a Shopify automation's `type` to the starter template that's safe to
// attach when the automation's `template` text is still exactly the known
// default (see app/api/automations/route.ts). win_back/repeat_purchase are
// deliberately absent — no backend trigger creates jobs for those types yet
// (see app/dashboard/automations/page.tsx), so there's nothing to attach a
// template to.
export const ECOM_TEMPLATE_BY_TYPE: Record<string, string> = {
  abandoned_cart:       'wapaci_abandoned_cart',
  cod_verification:     'wapaci_cod_verification',
  order_confirmation:   'wapaci_order_confirmation',
  shipping_update:      'wapaci_shipping_update',
  post_purchase_upsell: 'wapaci_post_purchase_upsell',
  review_request:       'wapaci_review_request',
}

export interface TemplateProvisionResult {
  name:    string
  status:  'submitted' | 'already_exists' | 'updated' | 'failed' | 'retry_later'
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Delete existing templates and re-submit with current body text.
// Use this when the template copy changes and you need Meta to re-review.
//
// Two things made the old version of this look broken from the UI (the
// "Update on Meta" button in app/dashboard/templates/page.tsx): it ran all
// ~14 templates SEQUENTIALLY (delete+re-submit is 2 network round-trips per
// template, each a few seconds — ~60-90s+ total is enough to hit Vercel's
// default function timeout before a response is ever sent, leaving the
// button stuck on "Updating…" with no toast either way), and Meta's delete
// doesn't always finish propagating before the immediate re-submit — the
// re-submit then fails with error_subcode 2388023 ("still being deleted"),
// which got reported as a generic 'failed' pointing the merchant at their
// WhatsApp connection, when the real cause was just needing to wait.
// Running every template in parallel fixes the first; a short bounded
// retry on that specific error code covers the common case of the second
// without risking the request hanging indefinitely on Meta's own, observed
// to sometimes run well past their stated "less than 1 minute" guidance —
// a template that's still stuck after this comes back 'retry_later' so the
// UI can say something accurate instead of blaming the connection.
async function deleteAndResubmit(
  wabaId: string, token: string, tmpl: StarterTemplate,
): Promise<TemplateProvisionResult> {
  const base = 'https://graph.facebook.com/v21.0'
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  try {
    // Step 1: delete by name (removes all language variants)
    await fetch(`${base}/${wabaId}/message_templates?name=${tmpl.name}`, { method: 'DELETE', headers })

    // Step 2: re-submit with updated body — retried a few times if Meta's
    // delete is still propagating (error_subcode 2388023), with increasing
    // delay. Bounded (~21s worst case) so one slow template can't blow out
    // the whole request's duration.
    const delays = [3000, 6000, 12000]
    for (let attempt = 0; ; attempt++) {
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
      const data = await res.json() as { id?: string; error?: { code: number; error_subcode?: number; message: string } }

      if (res.ok && data.id) {
        console.log(`[WA Templates] updated ${tmpl.name} → id=${data.id}`)
        return { name: tmpl.name, status: 'updated' }
      }

      const stillDeleting = data.error?.error_subcode === 2388023
      if (stillDeleting && attempt < delays.length) {
        await sleep(delays[attempt])
        continue
      }
      if (stillDeleting) {
        console.warn(`[WA Templates] ${tmpl.name} still mid-delete on Meta's side after retries — try again shortly`)
        return { name: tmpl.name, status: 'retry_later', error: 'Meta is still finishing a previous update to this template' }
      }
      console.warn(`[WA Templates] update failed for ${tmpl.name}:`, data.error)
      return { name: tmpl.name, status: 'failed', error: data.error?.message ?? 'Unknown error' }
    }
  } catch (e) {
    console.warn(`[WA Templates] update exception for ${tmpl.name}:`, e)
    return { name: tmpl.name, status: 'failed', error: String(e) }
  }
}

export async function updateStarterTemplates(
  wabaId: string,
  token:  string,
): Promise<TemplateProvisionResult[]> {
  return Promise.all(STARTER_TEMPLATES.map(tmpl => deleteAndResubmit(wabaId, token, tmpl)))
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

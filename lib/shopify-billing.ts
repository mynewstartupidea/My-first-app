export const SHOPIFY_PLANS = [
  {
    id:         'starter',
    name:       'Starter',
    price:      29,
    orders:     'Up to 500 orders/month',
    messages:   5_000,
    recommended: false,
  },
  {
    id:         'growth',
    name:       'Growth',
    price:      49,
    orders:     '500 – 5,000 orders/month',
    messages:   15_000,
    recommended: true,
  },
  {
    id:         'scale',
    name:       'Scale',
    price:      99,
    orders:     '5,000 – 10,000 orders/month',
    messages:   50_000,
    recommended: false,
  },
  {
    id:         'enterprise',
    name:       'Enterprise',
    price:      299,
    orders:     '10,000+ orders/month',
    messages:   -1,
    recommended: false,
  },
] as const

export type ShopifyPlanId = typeof SHOPIFY_PLANS[number]['id']

export const TRIAL_DAYS      = 7
export const TRIAL_MESSAGES  = 100
export const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.wapaci.com'

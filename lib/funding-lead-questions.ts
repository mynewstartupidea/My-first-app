// Single source of truth for /lp/funding's qualification questions — shared
// between the form UI (renders these exact options) and the submit route
// (validates a submitted answer is actually one of them, not arbitrary text
// smuggled in via a direct API call). Keep this list and the UI in sync by
// only ever editing it here.
export const FUNDING_QUESTIONS = [
  {
    key: 'funding_amount',
    question: 'How much funding are you currently looking to raise?',
    options: ['Under ₹5 lakh', '₹5–10 lakh', '₹10–15 lakh'],
  },
  {
    key: 'stage',
    question: 'What stage is your startup currently at?',
    options: [
      'Just an idea',
      'MVP / Product development',
      'Launched, but not generating revenue',
      'Generating revenue',
      'Established business looking to expand',
    ],
  },
  {
    key: 'monthly_revenue',
    question: "What is your startup's current monthly revenue?",
    options: ['Pre-revenue', 'Under ₹1 lakh', '₹1–5 lakh', '₹5–10 lakh', '₹10 lakh+'],
  },
  {
    key: 'registered',
    question: 'Is your business legally registered?',
    options: [
      'Yes, Private Limited Company',
      'Yes, LLP',
      'Yes, Partnership',
      'Yes, Proprietorship',
      'No, not registered yet',
    ],
  },
  {
    key: 'industry',
    question: 'What industry does your startup operate in?',
    options: [
      'Technology / SaaS',
      'E-commerce / D2C',
      'Manufacturing',
      'Healthcare',
      'Education / EdTech',
      'FinTech',
      'Food & Beverage',
      'Other',
    ],
  },
  {
    key: 'funding_use',
    question: 'What will you primarily use the funding for?',
    options: [
      'Product development',
      'Marketing and customer acquisition',
      'Hiring and team expansion',
      'Inventory and operations',
      'Business expansion',
      'Other',
    ],
  },
  {
    key: 'timeline',
    question: 'How soon are you looking to raise funding?',
    options: ['Immediately', 'Within 30 days', 'Within 1–3 months', 'Within 3–6 months', 'Just exploring options'],
  },
  {
    key: 'prior_funding',
    question: 'Have you previously raised any funding?',
    options: [
      'Yes, from angel investors',
      'Yes, from venture capital firms',
      'Yes, from friends and family',
      'No, this is my first fundraising round',
    ],
  },
] as const

export type FundingQuestionKey = typeof FUNDING_QUESTIONS[number]['key']

// Q9 — the one free-text field, kept separate from the multiple-choice
// questions above since it validates differently (non-empty length check,
// not an allow-list of options).
export const FUNDING_DESCRIPTION_QUESTION = 'Briefly describe your startup and what problem it solves.'
export const FUNDING_DESCRIPTION_MAX_LEN = 2000

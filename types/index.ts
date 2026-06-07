export type AutomationType = 'abandoned_cart' | 'cod_verification' | 'order_confirmation' | 'shipping_update' | 'post_purchase_upsell' | 'win_back' | 'review_request' | 'repeat_purchase'
export type JobStatus      = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
export type Plan           = 'starter' | 'growth' | 'scale'
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'failed'
export type CampaignAudience = 'all' | 'opted_in' | 'inactive_30' | 'inactive_60' | 'inactive_90'

export interface Store {
  id: string
  user_id: string
  shopify_domain: string | null
  shopify_access_token: string | null
  shop_name: string | null
  shop_email: string | null
  currency: string
  whatsapp_number: string | null
  whatsapp_bsp: string
  whatsapp_api_key: string | null
  is_active: boolean
  plan: Plan
  created_at: string
  updated_at: string
}

export interface Automation {
  id: string
  store_id: string
  type: AutomationType
  is_enabled: boolean
  delay_minutes: number
  template: string
  discount_enabled: boolean
  discount_value: number
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  store_id: string
  shopify_customer_id: string | null
  name: string | null
  phone: string
  email: string | null
  whatsapp_opt_in: boolean
  total_orders: number
  total_spent: number
  last_order_at: string | null
  created_at: string
}

export interface AutomationJob {
  id: string
  store_id: string
  automation_id: string | null
  type: AutomationType
  customer_phone: string
  customer_name: string | null
  message: string
  context: Record<string, unknown>
  status: JobStatus
  scheduled_at: string
  sent_at: string | null
  error_message: string | null
  retry_count: number
  created_at: string
}

export interface Message {
  id: string
  store_id: string
  job_id: string | null
  customer_phone: string
  customer_name: string | null
  type: string
  message: string
  status: string
  bsp_message_id: string | null
  revenue_attributed: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface AnalyticsDaily {
  id: string
  store_id: string
  date: string
  messages_sent: number
  messages_delivered: number
  carts_recovered: number
  revenue_recovered: number
  cod_verified: number
  cod_cancelled: number
}

export interface DashboardStats {
  revenue_recovered: number
  messages_sent: number
  carts_recovered: number
  cod_verified: number
  recovery_rate: number
}

export interface Campaign {
  id: string
  store_id: string
  name: string
  message: string
  audience: CampaignAudience
  status: CampaignStatus
  scheduled_at: string | null
  sent_count: number
  delivered_count: number
  failed_count: number
  created_at: string
  updated_at: string
}

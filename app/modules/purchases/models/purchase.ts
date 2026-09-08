import type { PaymentInput, PaymentObservation } from '#modules/purchases/interfaces/payment_port'

export interface PurchaseSnapshot {
  product_type: 'edition' | 'offer'
  offer_id: number | null
  amount_cents: number
  currency: string
  name: string
  description: string | null
  usage_starts_at: string
  usage_ends_at: string
  sales_starts_at: string
  sales_ends_at: string
  terms_version: string
  offers: Array<{
    id: number
    description: string
    benefit_type: string
    discount_percentage: number | null
    discount_amount_cents: number | null
    available_weekdays_mask: number
    daily_start_time: string | null
    daily_end_time: string | null
    starts_at: string | null
    ends_at: string | null
    reservation_required: boolean
    on_premise_only: boolean
    minimum_party_size: number
    establishment_id: number
    establishment: { id: number; public_name: string; slug: string | null }
    title: string
    terms: string | null
    max_redemptions_per_access: number
  }>
}
export interface Purchase {
  id: string
  tenant_id: number
  edition_id: number
  offer_id: number | null
  user_id: number
  key_hash: string
  request_hash: string
  snapshot: PurchaseSnapshot
  amount_cents: number
  currency: string
  method: 'pix' | 'card'
  provider: string
  provider_account: string
  provider_environment: 'test' | 'live'
  provider_id: string | null
  status: 'pending' | 'paid' | 'review' | 'failed' | 'cancelled' | 'refunded'
  access_id: number | null
  payment_input: string | null
  instructions: PaymentObservation['instructions']
  expires_at: Date
  paid_at: Date | null
  checked_at: Date | null
  refunded_cents: number
  issue: string | null
  created_at: Date
  updated_at: Date
}
export interface PurchaseRefund {
  id: string
  purchase_id: string
  tenant_id: number
  key_hash: string
  request_hash: string
  amount_cents: number
  baseline_refunded_cents: number
  status: 'review' | 'approved' | 'processing' | 'succeeded' | 'failed' | 'rejected'
  reason: string
  requested_by: number | null
  decided_by: number | null
  decision_reason: string | null
  created_at: Date
}
export interface PurchaseCommand {
  id: string
  purchase_id: string
  kind: 'create' | 'reconcile' | 'refund' | 'cancel'
  refund_id: string | null
  attempts: number
  created_at: Date
  dedupe_key: string
  lease_token: string
}
export interface CreatePurchaseInput extends PaymentInput {
  offer_id?: number | null
  edition_id: number
  amount_cents: number
  terms_version: string
  method: 'pix' | 'card'
}

export const BENEFIT_ACCESS_SOURCES = [
  'manual',
  'courtesy',
  'payment',
  'promo_code',
  'migration',
] as const

export const BENEFIT_ACCESS_STATUSES = ['active', 'revoked'] as const

export const WALLET_AVAILABILITY_STATUSES = [
  'available',
  'upcoming',
  'outside_schedule',
  'paused',
  'expired',
  'revoked',
  'redeemed',
] as const

namespace IBenefitAccess {
  export type Source = (typeof BENEFIT_ACCESS_SOURCES)[number]
  export type Status = (typeof BENEFIT_ACCESS_STATUSES)[number]
  export type Availability = (typeof WALLET_AVAILABILITY_STATUSES)[number]

  export interface GrantPayload {
    edition_id: number
    email: string
    source?: Source
    external_reference?: string | null
    notes?: string | null
  }

  export interface RevokePayload {
    reason?: string | null
  }

  export interface WalletBenefit {
    key: string
    access_id: number
    offer_id: number
    availability: Availability
    title: string
    description: string
    benefit_type: string
    discount_percentage: number | null
    discount_amount_cents: number | null
    terms: string | null
    available_weekdays_mask: number
    daily_start_time: string | null
    daily_end_time: string | null
    reservation_required: boolean
    on_premise_only: boolean
    minimum_party_size: number
    max_redemptions_per_access: number
    redemption_count?: number
    remaining_redemptions?: number
    latest_redemption?: {
      id: string
      receipt_code: string
      redeemed_at: string
    } | null
    establishment: {
      id: number
      public_name: string
      slug: string | null
    }
  }

  export interface WalletPass {
    access: {
      id: number
      source: Source
      status: Status
      granted_at: string
      availability: Availability
    }
    edition: {
      id: number
      name: string
      slug: string
      description: string | null
      price_cents: number
      currency: string
      usage_starts_at: string
      usage_ends_at: string
      status: string
      city: {
        id: number
        name: string
        slug: string
        state_code: string
        timezone: string
      }
    }
    benefits: WalletBenefit[]
  }

  export interface WalletProjection {
    summary: {
      passes: number
      benefits: number
      available: number
      upcoming: number
      redeemed: number
    }
    passes: WalletPass[]
  }
}

export default IBenefitAccess

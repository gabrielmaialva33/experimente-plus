export type BenefitAvailability =
  'available' | 'upcoming' | 'outside_schedule' | 'paused' | 'expired' | 'revoked' | 'redeemed'

export interface WalletBenefit {
  key: string
  access_id: number
  offer_id: number
  availability: BenefitAvailability
  title: string
  description: string
  benefit_type: string
  discount_percentage: number | null
  discount_amount_cents: number | null
  terms: string | null
  max_redemptions_per_access: number
  remaining_redemptions?: number
  establishment: {
    id: number
    public_name: string
    slug: string | null
  }
}

export interface WalletPass {
  access: {
    id: number
    source: string
    status: string
    granted_at: string
    availability: BenefitAvailability
  }
  edition: {
    id: number
    name: string
    slug: string
    description: string | null
    usage_starts_at: string
    usage_ends_at: string
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

export interface BenefitWallet {
  summary: {
    passes: number
    benefits: number
    available: number
    upcoming: number
    redeemed: number
  }
  passes: WalletPass[]
}

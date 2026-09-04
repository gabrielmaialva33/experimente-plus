export const BENEFIT_EDITION_STATUSES = ['draft', 'published', 'paused', 'archived'] as const
export const BENEFIT_OFFER_STATUSES = ['draft', 'active', 'paused', 'archived'] as const
export const BENEFIT_TYPES = [
  'buy_one_get_one',
  'percentage',
  'fixed_amount',
  'complimentary_item',
  'custom',
] as const

namespace IBenefit {
  export type EditionStatus = (typeof BENEFIT_EDITION_STATUSES)[number]
  export type OfferStatus = (typeof BENEFIT_OFFER_STATUSES)[number]
  export type Type = (typeof BENEFIT_TYPES)[number]

  /**
   * Deliberately small projection shared with consumers and the partner Portal.
   * Administrative relations such as offers and access grants must never be
   * serialized through this contract.
   */
  export interface AvailableEdition {
    id: number
    city_id: number
    name: string
    slug: string
    description: string | null
    price_cents: number
    currency: string
    sales_starts_at: string | null
    sales_ends_at: string | null
    usage_starts_at: string
    usage_ends_at: string
    status: EditionStatus
    published_at: string | null
    city: {
      id: number
      name: string
      state_code: string
    }
  }

  /**
   * Minimal offer projection rendered in the partner Portal. Internal ownership,
   * tenant and audit columns deliberately stay on the server-side model.
   */
  export interface PortalOffer {
    id: number
    edition_id: number
    title: string
    description: string
    benefit_type: Type
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
    status: OfferStatus
    edition: {
      id: number
      name: string
      status: EditionStatus
      currency: string
      usage_starts_at: string
      usage_ends_at: string
      city: {
        id: number
        name: string
        state_code: string
      }
    }
  }

  export interface CreateEditionPayload {
    city_id: number
    name: string
    slug?: string
    description?: string | null
    price_cents?: number
    currency?: string
    sales_starts_at?: string | null
    sales_ends_at?: string | null
    usage_starts_at: string
    usage_ends_at: string
  }

  export interface UpdateEditionPayload {
    city_id?: number
    name?: string
    slug?: string
    description?: string | null
    price_cents?: number
    currency?: string
    sales_starts_at?: string | null
    sales_ends_at?: string | null
    usage_starts_at?: string
    usage_ends_at?: string
  }

  export interface CreateOfferPayload {
    edition_id: number
    title: string
    description: string
    benefit_type: Type
    discount_percentage?: number | null
    discount_amount_cents?: number | null
    terms?: string | null
    available_weekdays_mask?: number
    daily_start_time?: string | null
    daily_end_time?: string | null
    starts_at?: string | null
    ends_at?: string | null
    reservation_required?: boolean
    on_premise_only?: boolean
    minimum_party_size?: number
    max_redemptions_per_access?: number
  }

  export interface UpdateOfferPayload {
    title?: string
    description?: string
    benefit_type?: Type
    discount_percentage?: number | null
    discount_amount_cents?: number | null
    terms?: string | null
    available_weekdays_mask?: number
    daily_start_time?: string | null
    daily_end_time?: string | null
    starts_at?: string | null
    ends_at?: string | null
    reservation_required?: boolean
    on_premise_only?: boolean
    minimum_party_size?: number
    max_redemptions_per_access?: number
  }
}

export default IBenefit

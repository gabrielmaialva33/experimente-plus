import type IBenefit from '#modules/benefits/interfaces/benefit_interface'

/** The category attribute a place uses for "Ticket médio": reais per person. */
export const AVERAGE_TICKET_ATTRIBUTE_KEY = 'average_ticket'

/** How many of the most visited places each period lists. */
export const SAVINGS_TOP_PLACES_LIMIT = 3

/**
 * What a person saved with their benefits, per edition (the yearly
 * subscription). Every number is derived on read from the immutable
 * redemptions; nothing is stored per person.
 */
namespace IBenefitSavings {
  export interface TopPlace {
    name: string
    visits: number
  }

  export interface EditionReference {
    id: number
    name: string
    /** The year the edition's usage window opens, on its city's clock. */
    year: number
  }

  export interface Totals {
    /** Distinct places with at least one use. */
    places_visited: number
    /** Every use, whatever the benefit type. */
    benefits_used: number
    /** Fixed-amount discounts, in cents. */
    savings_exact_cents: number
    /** Percentage discounts applied to the place's "Ticket médio", in cents. */
    savings_estimated_cents: number
    /** Uses of a money benefit whose value cannot be worked out (no "Ticket médio"). */
    uses_without_estimate: number
    top_places: TopPlace[]
  }

  /** The editions still open for use, together. */
  export interface Current extends Totals {
    editions: EditionReference[]
  }

  /** One edition whose usage window has closed. */
  export interface PastEdition extends Totals {
    edition: EditionReference
  }

  export interface Projection {
    currency: 'BRL'
    current: Current
    /** Newest first; only editions with at least one use. */
    past: PastEdition[]
  }

  /** One use, with the offer and edition columns the totals read. */
  export interface RedemptionRow {
    id: number
    edition_id: number
    establishment_id: number
    establishment_name_snapshot: string
    benefit_type_snapshot: IBenefit.Type
    redeemed_at: Date
    offer_benefit_type: IBenefit.Type
    discount_percentage: number | null
    discount_amount_cents: number | null
    edition_name: string
    edition_usage_starts_at: Date
    edition_usage_ends_at: Date
    city_timezone: string
  }
}

export default IBenefitSavings

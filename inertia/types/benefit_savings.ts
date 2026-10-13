/** What a person saved with their benefits: `GET /api/v1/me/savings` and the wallet page. */

export interface SavingsPlace {
  name: string
  visits: number
}

export interface SavingsEdition {
  id: number
  name: string
  year: number
}

export interface SavingsTotals {
  places_visited: number
  benefits_used: number
  savings_exact_cents: number
  savings_estimated_cents: number
  uses_without_estimate: number
  top_places: SavingsPlace[]
}

export interface BenefitSavings {
  currency: 'BRL'
  current: SavingsTotals & { editions: SavingsEdition[] }
  past: (SavingsTotals & { edition: SavingsEdition })[]
}

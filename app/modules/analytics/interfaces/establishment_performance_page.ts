import type { PerformancePeriodKey } from '#modules/analytics/utils/performance_period'

/**
 * The partner's "Desempenho" page of one place.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature. Every number is an aggregate: no person, session or receipt
 * travels to the page.
 */

/** One number in the chosen period and in the period it is compared with. */
export type PerformanceComparison = { current: number; previous: number }

export type PerformanceClickChannel = 'route' | 'whatsapp' | 'phone' | 'website'

export type PerformanceEstimate =
  /** Ticket médio published: benefits used × ticket, in cents. */
  | {
      status: 'available'
      average_ticket_cents: number
      current_cents: number
      previous_cents: number
    }
  /** The value was filled in a version of the data that is not published yet. */
  | { status: 'pending_review' }
  /** No value. `field_available` tells whether the place's category asks for one. */
  | { status: 'missing'; field_available: boolean }

export type EstablishmentPerformancePageProps = {
  establishment: {
    id: number
    name: string
    organization_id: number
    organization_name: string
    published: boolean
  }
  period: {
    key: PerformancePeriodKey
    from: string
    to: string
    previous_from: string
    previous_to: string
    days: number
    previous_days: number
  }
  /** The periods the selector offers; the edition only while one is running. */
  periods: PerformancePeriodKey[]
  edition: { name: string; starts_on: string; ends_on: string } | null
  metrics: {
    impressions: PerformanceComparison
    views: PerformanceComparison
    clicks: (PerformanceComparison & {
      channel: PerformanceClickChannel
      /** Whether the place shows this contact to the public today. */
      published: boolean
    })[]
    new_followers: PerformanceComparison
    new_favorites: PerformanceComparison
    redemptions: PerformanceComparison
    reviews: {
      count: PerformanceComparison
      average: { current: number | null; previous: number | null }
    }
  }
  estimate: PerformanceEstimate
  /** One entry per day of the chosen period, zeros included. */
  trend: { date: string; impressions: number; views: number; clicks: number }[]
}

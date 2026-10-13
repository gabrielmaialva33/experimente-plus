import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type {
  EstablishmentPerformancePageProps,
  PerformanceClickChannel,
  PerformanceComparison,
  PerformanceEstimate,
} from '#modules/analytics/interfaces/establishment_performance_page'
import EstablishmentPerformanceRepository, {
  AVERAGE_TICKET_ATTRIBUTE_KEY,
  PERFORMANCE_CLICK_EVENTS,
  type PerformanceEstablishment,
} from '#modules/analytics/repositories/establishment_performance_repository'
import AnalyticsPolicyService from '#modules/analytics/services/analytics_policy_service'
import {
  DEFAULT_PERFORMANCE_PERIOD,
  instantBounds,
  PERFORMANCE_PERIODS,
  type PerformancePeriodKey,
  performanceWindows,
  performanceZone,
  rangeLength,
} from '#modules/analytics/utils/performance_period'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import type User from '#modules/users/models/user'

/** The calendar used when a place has no city yet; it is the cities' own default. */
const FALLBACK_TIMEZONE = 'America/Sao_Paulo'

const CLICK_CHANNELS = Object.keys(PERFORMANCE_CLICK_EVENTS) as PerformanceClickChannel[]

const ZERO: PerformanceComparison = { current: 0, previous: 0 }

/** Versions still on their way to publication; a rejected one is not. */
const OPEN_REVISION_STATUSES = new Set(['draft', 'pending_review', 'changes_requested'])

/**
 * "Desempenho" of one place: discovery, engagement and benefit results in a
 * period, each next to the period it is compared with.
 *
 * Access is the analytics policy of the place's organization (ADR-0017): owner,
 * admin and analyst members and platform administrators read it; an editor or
 * a moderator is refused, and anyone outside the organization finds nothing.
 * The sales figure is an estimate — benefits used × the place's published
 * "Ticket médio" — and the page says so; without a ticket there is no figure.
 */
@inject()
export default class EstablishmentPerformanceService {
  constructor(
    private repository: EstablishmentPerformanceRepository,
    private policy: AnalyticsPolicyService,
    private effectiveAttributes: EffectiveCategoryAttributesService
  ) {}

  async page(
    tenantId: number,
    establishmentId: number,
    actor: User,
    query: { period?: PerformancePeriodKey },
    now: DateTime = DateTime.now()
  ): Promise<EstablishmentPerformancePageProps> {
    const establishment = await this.repository.findEstablishment(tenantId, establishmentId)
    if (!establishment) {
      throw new NotFoundException('Establishment performance not found')
    }

    await this.policy.requireOrganizationRead(tenantId, establishment.organization_id, actor)

    const zone = performanceZone(establishment.city_timezone, FALLBACK_TIMEZONE)
    const today = now.setZone(zone).toISODate()!
    const edition = await this.repository.currentEdition(tenantId, establishmentId, now.toJSDate())
    const editionDays = edition
      ? {
          starts_on: DateTime.fromJSDate(edition.usage_starts_at).setZone(zone).toISODate()!,
          ends_on: DateTime.fromJSDate(edition.usage_ends_at).setZone(zone).toISODate()!,
        }
      : null
    const windows = performanceWindows(
      query.period ?? DEFAULT_PERFORMANCE_PERIOD,
      today,
      editionDays
    )
    const bounds = {
      current: instantBounds(windows.current, zone),
      previous: instantBounds(windows.previous, zone),
    }

    // One after the other: each read is small and indexed, and a shared
    // connection (a test's global transaction) must not run two at once.
    const events = await this.repository.eventTotals(
      tenantId,
      establishmentId,
      windows.current,
      windows.previous
    )
    const trend = await this.repository.dailyTrend(tenantId, establishmentId, windows.current)
    const followers = await this.repository.newFollowers(tenantId, establishmentId, bounds)
    const favorites = await this.repository.newFavorites(tenantId, establishmentId, bounds)
    const redemptions = await this.repository.redemptions(tenantId, establishmentId, bounds)
    const reviews = await this.repository.reviews(tenantId, establishmentId, bounds)
    const contacts = await this.repository.publishedContacts(tenantId, establishmentId)
    const estimate = await this.ticket(tenantId, establishment)

    const event = (type: string) => events.get(type) ?? ZERO

    return {
      establishment: {
        id: establishment.id,
        name: establishment.public_name ?? `Lugar ${establishment.id}`,
        organization_id: establishment.organization_id,
        organization_name: establishment.organization_name,
        published: establishment.published_revision_id !== null,
      },
      period: {
        key: windows.key,
        from: windows.current.from,
        to: windows.current.to,
        previous_from: windows.previous.from,
        previous_to: windows.previous.to,
        days: rangeLength(windows.current),
        previous_days: rangeLength(windows.previous),
      },
      periods: PERFORMANCE_PERIODS.filter((key) => key !== 'current_edition' || editionDays),
      edition: edition && editionDays ? { name: edition.name, ...editionDays } : null,
      metrics: {
        impressions: event('catalog_impression'),
        views: event('establishment_view'),
        clicks: CLICK_CHANNELS.map((channel) => ({
          channel,
          published: contacts[channel],
          ...event(PERFORMANCE_CLICK_EVENTS[channel]),
        })),
        new_followers: followers,
        new_favorites: favorites,
        redemptions,
        reviews,
      },
      estimate:
        estimate.status === 'available'
          ? {
              ...estimate,
              current_cents: redemptions.current * estimate.average_ticket_cents,
              previous_cents: redemptions.previous * estimate.average_ticket_cents,
            }
          : estimate,
      trend,
    }
  }

  /**
   * The ticket the estimate multiplies by: the published one, since it is the
   * value the operation approved and the public reads. A newer version with a
   * value waits for approval; without either, the page asks for it only when
   * the place's category actually has the field.
   */
  private async ticket(
    tenantId: number,
    establishment: PerformanceEstablishment
  ): Promise<
    | { status: 'available'; average_ticket_cents: number }
    | Exclude<PerformanceEstimate, { status: 'available' }>
  > {
    const revisionIds = [
      establishment.published_revision_id,
      establishment.latest_revision_id,
    ].filter((id): id is number => id !== null)
    const tickets = await this.repository.averageTickets(tenantId, revisionIds)

    const published = establishment.published_revision_id
      ? tickets.get(establishment.published_revision_id)
      : undefined
    if (published !== undefined) {
      return { status: 'available', average_ticket_cents: Math.round(published * 100) }
    }

    if (
      establishment.latest_revision_id !== null &&
      establishment.latest_revision_id !== establishment.published_revision_id &&
      OPEN_REVISION_STATUSES.has(establishment.latest_revision_status ?? '') &&
      tickets.has(establishment.latest_revision_id)
    ) {
      return { status: 'pending_review' }
    }

    return {
      status: 'missing',
      field_available: await this.ticketFieldAvailable(tenantId, establishment),
    }
  }

  private async ticketFieldAvailable(
    tenantId: number,
    establishment: PerformanceEstablishment
  ): Promise<boolean> {
    if (establishment.primary_category_id === null) return false

    try {
      const effective = await this.effectiveAttributes.resolve(
        tenantId,
        establishment.primary_category_id
      )
      return effective.some(({ definition }) => definition.key === AVERAGE_TICKET_ATTRIBUTE_KEY)
    } catch (error) {
      // An inactive, removed or non-leaf category has no fields to fill.
      if (error instanceof NotFoundException || error instanceof BadRequestException) return false
      throw error
    }
  }
}

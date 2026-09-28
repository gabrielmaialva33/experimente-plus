import { randomUUID } from 'node:crypto'

import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import { throwawayDigest } from '#database/factories/support/throwaway'
import { ANALYTICS_ACTION_EVENT } from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsDailyMetric from '#modules/analytics/models/analytics_daily_metric'
import AnalyticsDailySearchTerm from '#modules/analytics/models/analytics_daily_search_term'
import AnalyticsEvent from '#modules/analytics/models/analytics_event'
import AnalyticsPrivacyService from '#modules/analytics/services/analytics_privacy_service'
import env from '#start/env'

/** Every city of the product runs on São Paulo time, which is what dates a metric. */
const ZONE = 'America/Sao_Paulo'

/** Searches a visitor might leave without results, with the category they were browsing. */
const SEARCHES = [
  ['pizza vegana', 'pizzarias'],
  ['café com wi-fi', 'cafes'],
  ['rodízio de sushi', 'cozinha-japonesa'],
  ['bar com música ao vivo', 'bares'],
  ['pão sem glúten', 'padarias'],
  ['sorvete de açaí', 'sorveterias'],
] as const

const rawRetentionDays = () => env.get('ANALYTICS_RAW_RETENTION_DAYS') ?? 90
const aggregateRetentionMonths = () => env.get('ANALYTICS_AGGREGATE_RETENTION_MONTHS') ?? 25

/** A search term as the privacy pipeline stores it: redacted text and its keyed hash. */
function redactedSearch(term: string) {
  const { redacted, hash } = new AnalyticsPrivacyService().redactSearchTerm(term)
  return { search_term_redacted: redacted, search_term_hash: hash }
}

/** The category a factory search was made in, if the term is one of `SEARCHES`. */
function searchCategory(term: string | null) {
  return SEARCHES.find(([search]) => search === term)?.[1] ?? null
}

/** The occurrence of a raw event, with the local day and the retention derived from it. */
function occurrence(occurredAt: DateTime) {
  return {
    occurred_at: occurredAt,
    metric_date: occurredAt.setZone(ZONE).toISODate()!,
    expires_at: occurredAt.plus({ days: rawRetentionDays() }),
  }
}

/** The event window of one aggregate day (09:00–21:00 local) and its retention. */
function dailyWindow(metricDate: string) {
  const opening = DateTime.fromISO(metricDate, { zone: ZONE }).set({ hour: 9 })
  const closing = opening.set({ hour: 21 })
  return {
    metric_date: metricDate,
    first_event_at: opening.toUTC(),
    last_event_at: closing.toUTC(),
    expires_at: closing.plus({ months: aggregateRetentionMonths() }).toUTC(),
  }
}

/** A local day far enough back that its aggregate is past retention. */
function expiredDay() {
  return DateTime.now()
    .setZone(ZONE)
    .minus({ months: aggregateRetentionMonths(), days: 2 })
    .toISODate()!
}

function yesterday() {
  return DateTime.now().setZone(ZONE).minus({ days: 1 }).toISODate()!
}

/**
 * A raw, append-only analytics event: an establishment view from the public
 * web a few hours ago. Identifiers are fresh per row (`event_id`,
 * `dedupe_key`); the anonymous session is a throwaway digest. Merging
 * `occurred_at` alone moves the local day and the retention with it.
 *
 * These rows do not feed the daily aggregates, which `AnalyticsEventService`
 * maintains as it records; use the aggregate factories (or the service) for
 * dashboards.
 */
export const AnalyticsEventFactory = factory
  .define(AnalyticsEvent, ({ faker }) => ({
    tenant_id: 1,
    event_id: randomUUID(),
    event_type: 'establishment_view' as const,
    establishment_id: 1,
    published_revision_id: 1,
    city_id: 1,
    anonymous_session_hash: throwawayDigest(),
    dedupe_key: throwawayDigest(),
    source: 'web' as const,
    search_term_redacted: null,
    search_term_hash: null,
    category_slug: null,
    metadata: null,
    ...occurrence(DateTime.utc().minus({ minutes: faker.number.int({ min: 5, max: 600 }) })),
  }))
  .merge((event, attributes) => {
    event.merge(
      attributes.occurred_at && !attributes.metric_date
        ? { ...occurrence(attributes.occurred_at), ...attributes }
        : attributes
    )
  })
  .state('impression', (event) => {
    event.event_type = 'catalog_impression'
  })
  .state('redirect', (event, { faker }) => {
    event.event_type = faker.helpers.arrayElement(Object.values(ANALYTICS_ACTION_EVENT))
    event.source = 'redirect'
  })
  .state('searchWithoutResults', (event, { faker }) => {
    const [term, category] = faker.helpers.arrayElement(SEARCHES)
    event.event_type = 'search_without_results'
    event.establishment_id = null
    event.published_revision_id = null
    event.merge(redactedSearch(term))
    event.category_slug = category
  })
  .state('expired', (event) => {
    event.merge(occurrence(DateTime.utc().minus({ days: rawRetentionDays() + 30 })))
  })
  .build()

/**
 * Yesterday's establishment views from the web, as the aggregation keeps them:
 * one row per day, event type, establishment and source. Vary one of those
 * for more rows; merging `metric_date` alone moves the event window and the
 * retention to that day, so `merge(days.map((metric_date) => ({ metric_date })))`
 * builds a series.
 */
export const AnalyticsDailyMetricFactory = factory
  .define(AnalyticsDailyMetric, ({ faker }) => {
    const eventCount = faker.number.int({ min: 3, max: 60 })
    return {
      tenant_id: 1,
      establishment_id: 1,
      city_id: 1,
      event_type: 'establishment_view' as const,
      source: 'web' as const,
      event_count: eventCount,
      unique_sessions: faker.number.int({ min: 1, max: eventCount }),
      ...dailyWindow(yesterday()),
    }
  })
  .merge((metric, attributes) => {
    metric.merge(
      attributes.metric_date && !attributes.first_event_at
        ? { ...dailyWindow(attributes.metric_date), ...attributes }
        : attributes
    )
  })
  .state('redirect', (metric, { faker }) => {
    metric.event_type = faker.helpers.arrayElement(Object.values(ANALYTICS_ACTION_EVENT))
    metric.source = 'redirect'
  })
  .state('expired', (metric) => {
    metric.merge(dailyWindow(expiredDay()))
  })
  .build()

/**
 * Yesterday's count of one search without results in a city, redacted and
 * hashed by the same privacy pipeline as live traffic, outside any category.
 * One row per day, city, term and category: vary one of those for more rows
 * (merging `metric_date` alone moves the window, as for the metrics).
 */
export const AnalyticsDailySearchTermFactory = factory
  .define(AnalyticsDailySearchTerm, ({ faker }) => {
    const eventCount = faker.number.int({ min: 1, max: 25 })
    return {
      tenant_id: 1,
      city_id: 1,
      ...redactedSearch(faker.helpers.arrayElement(SEARCHES)[0]),
      category_slug: null,
      category_key: '',
      event_count: eventCount,
      unique_sessions: faker.number.int({ min: 1, max: eventCount }),
      ...dailyWindow(yesterday()),
    }
  })
  .merge((term, attributes) => {
    term.merge(
      attributes.metric_date && !attributes.first_event_at
        ? { ...dailyWindow(attributes.metric_date), ...attributes }
        : attributes
    )
  })
  .state('inCategory', (term) => {
    // The table requires the key to repeat the slug, and '' for no category.
    const category = searchCategory(term.search_term_redacted) ?? 'restaurantes'
    term.category_slug = category
    term.category_key = category
  })
  .state('expired', (term) => {
    term.merge(dailyWindow(expiredDay()))
  })
  .build()

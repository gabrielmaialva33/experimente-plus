import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import {
  ANALYTICS_ESTABLISHMENT_EVENT_TYPES,
  type IAnalytics,
} from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsEventRepository from '#modules/analytics/repositories/analytics_event_repository'
import type { AnalyticsEventInsert } from '#modules/analytics/repositories/analytics_event_repository'
import AnalyticsDedupeService from '#modules/analytics/services/analytics_dedupe_service'
import AnalyticsTargetService from '#modules/analytics/services/analytics_target_service'
import env from '#start/env'

@inject()
export default class AnalyticsEventService {
  constructor(
    private targetService: AnalyticsTargetService,
    private dedupeService: AnalyticsDedupeService,
    private eventRepository: AnalyticsEventRepository
  ) {}

  async resolveTenant(hostname: string | null): Promise<number> {
    return this.targetService.resolveTenant(hostname)
  }

  async recordBatch(
    hostname: string | null,
    events: IAnalytics.PublicEventInput[],
    anonymousSessionHash: string,
    source: IAnalytics.Source = 'web'
  ): Promise<IAnalytics.BatchResult> {
    const tenantId = await this.resolveTenant(hostname)
    return this.recordBatchForTenant(tenantId, events, anonymousSessionHash, source)
  }

  async recordBatchForTenant(
    tenantId: number,
    events: IAnalytics.PublicEventInput[],
    anonymousSessionHash: string,
    source: IAnalytics.Source = 'web'
  ): Promise<IAnalytics.BatchResult> {
    const resolvedEvents: IAnalytics.ResolvedEvent[] = []

    for (const event of events) {
      resolvedEvents.push(await this.targetService.resolveEvent(tenantId, event, source))
    }

    const occurredAt = DateTime.utc()
    const rawExpiresAt = occurredAt.plus({
      days: env.get('ANALYTICS_RAW_RETENTION_DAYS') ?? 90,
    })
    const aggregateExpiresAt = occurredAt.plus({
      months: env.get('ANALYTICS_AGGREGATE_RETENTION_MONTHS') ?? 25,
    })

    const results = await db.transaction(async (client) => {
      const records: IAnalytics.RecordResult[] = []

      for (const event of resolvedEvents) {
        const metricDate = occurredAt.setZone(event.target.city_timezone).toISODate()
        if (!metricDate) {
          throw new BadRequestException('The city timezone could not produce an analytics date')
        }

        const establishmentTarget = 'establishment_id' in event.target ? event.target : null
        const data: AnalyticsEventInsert = {
          tenant_id: tenantId,
          event_id: event.event_id,
          event_type: event.event_type,
          establishment_id: establishmentTarget?.establishment_id ?? null,
          published_revision_id: establishmentTarget?.published_revision_id ?? null,
          city_id: event.target.city_id,
          metric_date: metricDate,
          anonymous_session_hash: anonymousSessionHash,
          dedupe_key: this.dedupeService.key(tenantId, anonymousSessionHash, event, occurredAt),
          source: event.source,
          search_term_redacted: event.search_term_redacted,
          search_term_hash: event.search_term_hash,
          category_slug: event.category_slug,
          metadata: null,
          occurred_at: occurredAt,
          expires_at: rawExpiresAt,
        }

        const inserted = await this.eventRepository.insertEvent(data, client)
        if (inserted) {
          if (event.event_type === 'search_without_results') {
            await this.eventRepository.aggregateSearchWithoutResults(
              data as AnalyticsEventInsert & {
                event_type: 'search_without_results'
                search_term_hash: string
                search_term_redacted: string
              },
              aggregateExpiresAt,
              client
            )
          } else if (
            establishmentTarget &&
            ANALYTICS_ESTABLISHMENT_EVENT_TYPES.includes(
              event.event_type as IAnalytics.EstablishmentEventType
            )
          ) {
            await this.eventRepository.aggregateEstablishmentEvent(
              data as AnalyticsEventInsert & {
                establishment_id: number
                event_type: IAnalytics.EstablishmentEventType
              },
              aggregateExpiresAt,
              client
            )
          }
        }

        records.push({
          event_id: event.event_id,
          recorded: inserted,
          deduplicated: !inserted,
        })
      }

      return records
    })

    const recorded = results.filter((event) => event.recorded).length
    return {
      accepted: results.length,
      recorded,
      deduplicated: results.length - recorded,
      suppressed: 0,
      events: results,
    }
  }
}

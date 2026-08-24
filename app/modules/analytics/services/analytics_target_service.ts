import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import {
  ANALYTICS_ESTABLISHMENT_EVENT_TYPES,
  type IAnalytics,
} from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsTargetRepository from '#modules/analytics/repositories/analytics_target_repository'
import AnalyticsPrivacyService from '#modules/analytics/services/analytics_privacy_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

const CONVERSION_EVENTS = new Set<IAnalytics.EventType>([
  'route_click',
  'whatsapp_click',
  'phone_click',
  'website_click',
])

@inject()
export default class AnalyticsTargetService {
  constructor(
    private operationResolver: PublicOperationResolver,
    private targetRepository: AnalyticsTargetRepository,
    private privacyService: AnalyticsPrivacyService
  ) {}

  async resolveTenant(hostname: string | null): Promise<number> {
    const tenant = await this.operationResolver.resolve(hostname)
    return tenant.id
  }

  async resolveActionTarget(
    tenantId: number,
    citySlug: string,
    establishmentSlug: string
  ): Promise<IAnalytics.CatalogTarget> {
    const target = await this.targetRepository.findEstablishment(
      tenantId,
      citySlug,
      establishmentSlug
    )

    if (!target || !target.is_discoverable || target.business_status === 'permanently_closed') {
      throw new NotFoundException('Actionable establishment not found')
    }

    return target
  }

  async resolveEvent(
    tenantId: number,
    input: IAnalytics.PublicEventInput,
    source: IAnalytics.Source
  ): Promise<IAnalytics.ResolvedEvent> {
    const categorySlug = input.category_slug ?? null

    if (categorySlug && !(await this.targetRepository.isPublicCategory(tenantId, categorySlug))) {
      throw new NotFoundException('Public category not found')
    }

    if (input.event_type === 'search_without_results') {
      if (!input.search_term || input.establishment_slug) {
        throw new BadRequestException(
          'search_without_results requires search_term and does not accept establishment_slug'
        )
      }

      const city = await this.targetRepository.findCity(tenantId, input.city_slug)
      if (!city) {
        throw new NotFoundException('Public city not found')
      }

      const term = this.privacyService.redactSearchTerm(input.search_term)
      return {
        event_id: input.event_id,
        event_type: input.event_type,
        source,
        target: city,
        category_slug: categorySlug,
        search_term_redacted: term.redacted,
        search_term_hash: term.hash,
      }
    }

    if (
      !ANALYTICS_ESTABLISHMENT_EVENT_TYPES.includes(
        input.event_type as IAnalytics.EstablishmentEventType
      ) ||
      !input.establishment_slug ||
      input.search_term
    ) {
      throw new BadRequestException(
        'Establishment analytics events require establishment_slug and do not accept search_term'
      )
    }

    const target = await this.targetRepository.findEstablishment(
      tenantId,
      input.city_slug,
      input.establishment_slug
    )
    if (!target) {
      throw new NotFoundException('Published establishment not found')
    }

    if (input.event_type === 'catalog_impression' && !target.is_discoverable) {
      throw new NotFoundException('Discoverable establishment not found')
    }

    if (
      CONVERSION_EVENTS.has(input.event_type) &&
      (!target.is_discoverable || target.business_status === 'permanently_closed')
    ) {
      throw new NotFoundException('Actionable establishment not found')
    }

    return {
      event_id: input.event_id,
      event_type: input.event_type,
      source,
      target,
      category_slug: categorySlug,
      search_term_redacted: null,
      search_term_hash: null,
    }
  }
}

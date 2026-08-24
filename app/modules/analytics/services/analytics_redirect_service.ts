import { randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'

import NotFoundException from '#exceptions/not_found_exception'
import { ANALYTICS_ACTION_EVENT } from '#modules/analytics/interfaces/analytics_interface'
import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsEventService from '#modules/analytics/services/analytics_event_service'
import AnalyticsTargetService from '#modules/analytics/services/analytics_target_service'

@inject()
export default class AnalyticsRedirectService {
  constructor(
    private targetService: AnalyticsTargetService,
    private eventService: AnalyticsEventService
  ) {}

  async destination(
    tenantId: number,
    citySlug: string,
    establishmentSlug: string,
    action: IAnalytics.ExternalAction,
    anonymousSessionHash: string | null
  ): Promise<string> {
    const target = await this.targetService.resolveActionTarget(
      tenantId,
      citySlug,
      establishmentSlug
    )
    const destination = this.resolveDestination(target, action)

    if (anonymousSessionHash) {
      try {
        await this.eventService.recordBatchForTenant(
          tenantId,
          [
            {
              event_id: randomUUID(),
              event_type: ANALYTICS_ACTION_EVENT[action],
              city_slug: citySlug,
              establishment_slug: establishmentSlug,
            },
          ],
          anonymousSessionHash,
          'redirect'
        )
      } catch (error) {
        logger.warn(
          {
            err: error,
            tenant_id: tenantId,
            establishment_id: target.establishment_id,
            action,
          },
          'Analytics recording failed for a safe outbound action'
        )
      }
    }

    return destination
  }

  private resolveDestination(
    target: IAnalytics.CatalogTarget,
    action: IAnalytics.ExternalAction
  ): string {
    if (action === 'route') {
      if (target.latitude === null || target.longitude === null) {
        throw new NotFoundException('Route is unavailable for this establishment')
      }

      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${target.latitude},${target.longitude}`
      )}`
    }

    if (action === 'website') {
      if (!target.website) {
        throw new NotFoundException('Website is unavailable for this establishment')
      }

      try {
        const website = new URL(target.website)
        if (!['http:', 'https:'].includes(website.protocol)) {
          throw new NotFoundException('Website is unavailable for this establishment')
        }

        return website.toString()
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error
        }

        throw new NotFoundException('Website is unavailable for this establishment')
      }
    }

    if (action === 'phone') {
      const phone = this.brazilianNumber(target.public_phone)
      if (!phone) {
        throw new NotFoundException('Phone is unavailable for this establishment')
      }

      return `tel:+${phone}`
    }

    const whatsapp = this.brazilianNumber(target.whatsapp ?? target.public_phone)
    if (!whatsapp) {
      throw new NotFoundException('WhatsApp is unavailable for this establishment')
    }

    return `https://wa.me/${whatsapp}`
  }

  private brazilianNumber(value: string | null): string | null {
    if (!value) {
      return null
    }

    const digits = value.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) {
      return null
    }

    if (digits.length <= 11) {
      return `55${digits}`
    }

    return digits.startsWith('55') ? digits : null
  }
}

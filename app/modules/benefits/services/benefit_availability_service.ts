import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import BenefitOfferRepository from '#modules/benefits/repositories/benefit_offer_repository'
import {
  DEFAULT_BENEFIT_TIMEZONE,
  usableLaterToday,
} from '#modules/benefits/utils/benefit_offer_schedule'

/**
 * Which places have a benefit someone can still use today — "Vale hoje" of the
 * public catalogue.
 *
 * Public and anonymous: it says nothing about any person's access, only that an
 * active offer of a published edition, at a deliverable establishment, is
 * inside its windows for what is left of the local day, on a weekday its mask
 * allows. The catalogue reads the answer; it never repeats these rules.
 */
@inject()
export default class BenefitAvailabilityService {
  constructor(private offers: BenefitOfferRepository) {}

  async establishmentsUsableToday(
    tenantId: number,
    now: DateTime = DateTime.utc()
  ): Promise<number[]> {
    // A day ends at most 24 hours from now in any timezone, so this window holds
    // every candidate; the schedule then decides each one in its city's own day.
    const candidates = await this.offers.listActiveInUsageWindow(
      tenantId,
      now,
      now.plus({ days: 1 })
    )
    const establishments = new Set<number>()

    for (const offer of candidates) {
      if (establishments.has(offer.establishment_id)) continue
      const timezone = offer.edition.city?.timezone || DEFAULT_BENEFIT_TIMEZONE
      if (usableLaterToday(offer, offer.edition, timezone, now)) {
        establishments.add(offer.establishment_id)
      }
    }

    return [...establishments].sort((left, right) => left - right)
  }
}

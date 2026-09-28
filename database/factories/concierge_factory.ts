import factory from '@adonisjs/lucid/factories'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'
import ConciergePolicy from '#modules/concierge/models/concierge_policy'

/**
 * The Concierge parameters of an operation, one row per tenant, starting from
 * the provisional ADR-0029 defaults. The table bounds both numbers
 * (`IConcierge.POLICY_RANGES`); `strict` sits on the lower edge of each.
 */
export const ConciergePolicyFactory = factory
  .define(ConciergePolicy, () => ({
    tenant_id: 1,
    ...IConcierge.DEFAULT_POLICY,
  }))
  .state('disabled', (policy) => {
    policy.enabled = false
  })
  .state('strict', (policy) => {
    policy.max_catalog_items = IConcierge.POLICY_RANGES.max_catalog_items.min
    policy.daily_questions_per_person = IConcierge.POLICY_RANGES.daily_questions_per_person.min
  })
  .build()

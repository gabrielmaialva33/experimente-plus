import db from '@adonisjs/lucid/services/db'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'
import ConciergePolicy from '#modules/concierge/models/concierge_policy'

export default class ConciergePolicyRepository {
  /**
   * The values a question is answered with. Read-only on purpose: the public
   * route runs this for every visitor, and creating the row here would make
   * two first questions at once race on the tenant's unique key. Until an
   * administrator saves the policy, the defaults apply without being stored.
   */
  async effectiveForTenant(tenantId: number): Promise<IConcierge.PolicyValues> {
    const stored = await ConciergePolicy.query().where('tenant_id', tenantId).first()
    if (!stored) return { ...IConcierge.DEFAULT_POLICY }

    return {
      enabled: stored.enabled,
      max_catalog_items: stored.max_catalog_items,
      daily_questions_per_person: stored.daily_questions_per_person,
    }
  }

  /**
   * The row an administrator reads and edits, created with the provisional
   * defaults on first read like the review and moderation policies. Written
   * explicitly rather than left to the column defaults, because Lucid does not
   * read column defaults back after insert, and inserted with ON CONFLICT so two
   * first reads at once both find the same row instead of one failing.
   */
  async getForTenant(tenantId: number): Promise<ConciergePolicy> {
    const existing = await ConciergePolicy.query().where('tenant_id', tenantId).first()
    if (existing) return existing

    await db
      .table(ConciergePolicy.table)
      .insert({ tenant_id: tenantId, ...IConcierge.DEFAULT_POLICY })
      .onConflict('tenant_id')
      .ignore()

    return ConciergePolicy.query().where('tenant_id', tenantId).firstOrFail()
  }

  async updateForTenant(
    tenantId: number,
    payload: IConcierge.UpdatePolicyPayload
  ): Promise<ConciergePolicy> {
    const policy = await this.getForTenant(tenantId)
    policy.merge(payload)
    await policy.save()
    return policy
  }
}

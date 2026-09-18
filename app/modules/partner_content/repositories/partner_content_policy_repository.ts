import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import LucidRepository from '#shared/lucid/lucid_repository'

/**
 * The defaults live in the table, not here: ADR-0028 set them so the feature is
 * buildable before the client decides, and the column default is the single
 * place that says so. A tenant with no row yet gets one on first read.
 */
export default class PartnerContentPolicyRepository extends LucidRepository<
  typeof PartnerContentPolicy
> {
  constructor() {
    super(PartnerContentPolicy)
  }

  async getForTenant(
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<PartnerContentPolicy> {
    const existing = await PartnerContentPolicy.query({ client })
      .where('tenant_id', tenantId)
      .first()

    if (existing) {
      return existing
    }

    const created = await PartnerContentPolicy.create({ tenant_id: tenantId }, { client })
    // The insert sends only the tenant, so every other value is the column
    // default and the instance in memory does not know them yet. Reading the
    // row back is what keeps the defaults in one place — the table.
    if (client) {
      created.useTransaction(client)
    }
    await created.refresh()
    return created
  }

  async updateForTenant(
    tenantId: number,
    payload: IPartnerContent.PolicyPayload,
    client?: TransactionClientContract
  ): Promise<PartnerContentPolicy> {
    const policy = await this.getForTenant(tenantId, client)
    if (client) {
      policy.useTransaction(client)
    }

    policy.merge(payload)
    await policy.save()
    return policy
  }

  /** Which kinds this operation holds for human approval before publishing. */
  requiresApproval(policy: PartnerContentPolicy, kind: IPartnerContent.ContentKind): boolean {
    if (kind === 'experience') return policy.require_experience_approval
    if (kind === 'event') return policy.require_event_approval
    return policy.require_showcase_item_approval
  }
}

import { inject } from '@adonisjs/core'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import type ConciergePolicy from '#modules/concierge/models/concierge_policy'
import ConciergePolicyRepository from '#modules/concierge/repositories/concierge_policy_repository'
import ConciergeProviderFactory from '#modules/concierge/services/concierge_provider_factory'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

/**
 * The operation's Concierge parameters — ADR-0029, revision of 26/09/2026;
 * Anexo I item 12, "gestão das informações necessárias ao funcionamento ... do
 * Concierge IA".
 *
 * Reading and changing them requires a platform administrator, exactly like
 * the review policy: the API and the screen both go through here, so the page
 * is never a wider door than the endpoint.
 */
@inject()
export default class ConciergePolicyService {
  constructor(
    private policies: ConciergePolicyRepository,
    private providers: ConciergeProviderFactory,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async getPolicy(tenantId: number, actor: User): Promise<ConciergePolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policies.getForTenant(tenantId)
  }

  async updatePolicy(
    tenantId: number,
    actor: User,
    payload: IConcierge.UpdatePolicyPayload
  ): Promise<ConciergePolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policies.updateForTenant(tenantId, payload)
  }

  /** The values a question is answered with; no role, no write. */
  effective(tenantId: number): Promise<IConcierge.PolicyValues> {
    return this.policies.effectiveForTenant(tenantId)
  }

  /** Read-only facts about the deployment, for the administration screen. */
  async infrastructure(actor: User): Promise<IConcierge.InfrastructureStatus> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.providers.status()
  }
}

import { inject } from '@adonisjs/core'

import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

@inject()
export default class AnalyticsPolicyService {
  constructor(private organizationPolicy: OrganizationPolicyService) {}

  async requireOrganizationRead(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<void> {
    await this.organizationPolicy.authorizeReadAnalytics(actor, tenantId, organizationId)
  }

  async requirePlatformSearchRead(actor: User): Promise<void> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
  }
}

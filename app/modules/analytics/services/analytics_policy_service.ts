import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

const ANALYTICS_ROLES = ['owner', 'admin', 'analyst'] as const

@inject()
export default class AnalyticsPolicyService {
  constructor(private organizationPolicy: OrganizationPolicyService) {}

  async requireOrganizationRead(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<void> {
    if (await this.organizationPolicy.isPlatformAdmin(actor)) {
      return
    }

    const membership = await OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('user_id', actor.id)
      .where('status', 'active')
      .first()

    if (!membership) {
      throw new NotFoundException('Organization analytics not found')
    }

    if (!ANALYTICS_ROLES.includes(membership.role as (typeof ANALYTICS_ROLES)[number])) {
      throw new ForbiddenException('This organization role cannot read analytics')
    }
  }

  async requirePlatformSearchRead(actor: User): Promise<void> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
  }
}

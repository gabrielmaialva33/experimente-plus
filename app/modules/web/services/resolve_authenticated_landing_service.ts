import { inject } from '@adonisjs/core'

import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import PlatformAccessRepository from '#modules/organizations/repositories/platform_access_repository'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import type User from '#modules/users/models/user'
import {
  authenticatedLandingPath,
  type AuthenticatedLandingPath,
} from '#modules/web/utils/authenticated_landing'
import { resolveActiveTenantId } from '#shared/utils/active_tenant'

/**
 * Where a signed-in person lands: reads the active operation, the platform
 * roles and the organization membership that `authenticatedLandingPath`
 * decides from.
 */
@inject()
export default class ResolveAuthenticatedLandingService {
  constructor(
    private tenantRepository: TenantRepository,
    private platformAccessRepository: PlatformAccessRepository,
    private memberRepository: OrganizationMemberRepository
  ) {}

  async run(user: User, claimedActiveTenantId?: number | null): Promise<AuthenticatedLandingPath> {
    const activeTenants = await this.tenantRepository.listActiveForUser(user)

    const activeTenantId = resolveActiveTenantId(activeTenants, claimedActiveTenantId)

    if (!activeTenantId) {
      return authenticatedLandingPath({ activeTenantId: null })
    }

    const roleSlugs = await this.platformAccessRepository.listRoleSlugs(user)
    const activeOrganizationMembership = await this.memberRepository.findActiveInTenant(
      activeTenantId,
      user.id
    )

    return authenticatedLandingPath({
      activeTenantId,
      hasActiveOrganizationMembership: Boolean(activeOrganizationMembership),
      roleSlugs,
    })
  }
}

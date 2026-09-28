import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import type Tenant from '#modules/tenants/models/tenant'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import type User from '#modules/users/models/user'

/** The operation a browser session may switch to: an active one the user belongs to. */
@inject()
export default class FindSwitchableTenantService {
  constructor(private tenantRepository: TenantRepository) {}

  async run(user: User, tenantId: number): Promise<Tenant> {
    const tenant = await this.tenantRepository.findActiveForUser(user, tenantId)

    if (!tenant) {
      throw new ForbiddenException('You do not belong to this active tenant')
    }

    return tenant
  }
}

import { inject } from '@adonisjs/core'

import type ITenant from '#modules/tenants/interfaces/tenant_interface'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import type User from '#modules/users/models/user'

/** The operations the authenticated user belongs to, each with the user's membership role. */
@inject()
export default class ListUserTenantsService {
  constructor(private tenantRepository: TenantRepository) {}

  async run(user: User): Promise<ITenant.UserTenant[]> {
    const tenants = await this.tenantRepository.listForUser(user)

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      is_active: tenant.is_active,
      role: tenant.$extras.pivot_role as string,
    }))
  }
}

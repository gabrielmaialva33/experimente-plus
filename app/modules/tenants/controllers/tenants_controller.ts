import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import TenantSessionService from '#modules/tenants/services/tenant_session_service'
import {
  createTenantValidator,
  switchTenantValidator,
} from '#modules/tenants/validators/tenant_validator'

@inject()
export default class TenantsController {
  constructor(private tenantSessionService: TenantSessionService) {}

  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenants = await user.related('tenants').query().orderBy('tenants.id', 'asc')

    const data = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      is_active: tenant.is_active,
      role: tenant.$extras.pivot_role as string,
    }))

    return response.ok({ data })
  }

  async create({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createTenantValidator)
    const {
      tenant,
      role,
      auth: tokens,
    } = await this.tenantSessionService.createAndRotate(user.id, payload)

    return response.created({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role,
      },
      auth: tokens,
    })
  }

  async switch({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(switchTenantValidator)
    const {
      tenant,
      role,
      auth: tokens,
    } = await this.tenantSessionService.switchAndRotate(user.id, payload)

    return response.ok({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role,
      },
      auth: tokens,
    })
  }
}

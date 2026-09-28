import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import { refreshTokenFromRawBody } from '#modules/auth/utils/refresh_token_input'
import ListUserTenantsService from '#modules/tenants/services/list_user_tenants_service'
import TenantSessionService from '#modules/tenants/services/tenant_session_service'
import {
  createTenantValidator,
  switchTenantValidator,
} from '#modules/tenants/validators/tenant_validator'

@inject()
export default class TenantsController {
  constructor(
    private tenantSessionService: TenantSessionService,
    private listUserTenantsService: ListUserTenantsService
  ) {}

  async me({ auth, response }: HttpContext) {
    const data = await this.listUserTenantsService.run(auth.getUserOrFail())

    return response.ok({ data })
  }

  async create({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createTenantValidator, {
      data: { ...request.body(), refresh_token: refreshTokenFromRawBody(request) },
    })
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
    const payload = await request.validateUsing(switchTenantValidator, {
      data: { ...request.body(), refresh_token: refreshTokenFromRawBody(request) },
    })
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

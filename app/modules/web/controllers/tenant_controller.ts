import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BadRequestException from '#exceptions/bad_request_exception'
import CreateTenantService from '#modules/tenants/services/create_tenant_service'
import { createWebTenantValidator } from '#modules/tenants/validators/tenant_validator'
import FindSwitchableTenantService from '#modules/web/services/find_switchable_tenant_service'

/**
 * Switches the active browser tenant by reissuing the signed HTTP-only access
 * cookie through the JWT guard. The guard owns all security claims and cookie
 * options, preventing this controller from drifting from API authentication.
 */
@inject()
export default class InertiaTenantController {
  constructor(
    private createTenantService: CreateTenantService,
    private findSwitchableTenantService: FindSwitchableTenantService
  ) {}

  async create({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createWebTenantValidator)
    const tenant = await this.createTenantService.run(user.id, payload)

    await auth.use('jwt').generate(user, { tenantId: tenant.id })
    session.flash('success', 'Operação criada com sucesso.')

    return response.redirect().toPath('/settings?tab=operations')
  }

  async switch({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = Number(request.input('tenant_id'))

    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('tenant_id is required and must be a positive integer')
    }

    const tenant = await this.findSwitchableTenantService.run(user, tenantId)

    await auth.use('jwt').generate(user, { tenantId: tenant.id })

    return response.redirect().back()
  }
}

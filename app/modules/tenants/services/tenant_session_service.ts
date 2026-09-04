import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import type { GenerateAuthTokensResponse } from '#modules/auth/services/jwt_auth_tokens_service'
import JwtAuthTokensService from '#modules/auth/services/jwt_auth_tokens_service'
import type Tenant from '#modules/tenants/models/tenant'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import CreateTenantService from '#modules/tenants/services/create_tenant_service'

type TenantSession = {
  tenant: Tenant
  role: string
}

export type TenantSessionResult = TenantSession & {
  auth: GenerateAuthTokensResponse
}

@inject()
export default class TenantSessionService {
  constructor(
    private jwtAuthTokensService: JwtAuthTokensService,
    private createTenantService: CreateTenantService,
    private tenantRepository: TenantRepository
  ) {}

  async createAndRotate(
    userId: number,
    payload: { name: string; refresh_token: string }
  ): Promise<TenantSessionResult> {
    const { value, auth } = await this.jwtAuthTokensService.rotateForAuthenticatedUser(
      payload.refresh_token,
      userId,
      async (client) => {
        const tenant = await this.createTenantService.run(userId, { name: payload.name }, client)

        return {
          tenantId: tenant.id,
          value: { tenant, role: 'owner' },
        }
      }
    )

    return { ...value, auth }
  }

  async switchAndRotate(
    userId: number,
    payload: { tenant_id: number; refresh_token: string }
  ): Promise<TenantSessionResult> {
    const { value, auth } = await this.jwtAuthTokensService.rotateForAuthenticatedUser(
      payload.refresh_token,
      userId,
      async (client) => {
        const membership = await this.tenantRepository.findActiveMembershipForUpdate(
          userId,
          payload.tenant_id,
          client
        )

        if (!membership) {
          throw new ForbiddenException('You do not belong to this active tenant')
        }

        return {
          tenantId: membership.tenant.id,
          value: membership,
        }
      }
    )

    return { ...value, auth }
  }
}

import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import UsersRepository from '#modules/users/repositories/users_repository'

export type OperationLink = {
  id: number
  name: string
  linked: boolean
}

/**
 * Links an account to an operation as `member`, the same link that sign-up
 * and invitation acceptance create: it gives the person a wallet in that
 * operation and lets organizations of it invite them.
 *
 * Idempotent and conservative: an existing link keeps its role and any ban,
 * so repeating the action, or running it for someone already linked, changes
 * nothing.
 */
@inject()
export default class AttachUserToOperationService {
  constructor(
    private usersRepository: UsersRepository,
    private tenantRepository: TenantRepository
  ) {}

  /** The active operation by id, as the back office names it. */
  async operation(tenantId: number): Promise<{ id: number; name: string } | null> {
    const tenant = await this.tenantRepository.findActiveById(tenantId)
    return tenant ? { id: tenant.id, name: tenant.name } : null
  }

  async status(userId: number, tenantId: number): Promise<OperationLink | null> {
    const operation = await this.operation(tenantId)
    if (!operation) {
      return null
    }

    const linked = await this.tenantRepository.hasMember(operation.id, userId)

    return { ...operation, linked }
  }

  async run(userId: number, tenantId: number): Promise<{ created: boolean; operation: string }> {
    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveById(userId, client)
      if (!user) {
        throw new NotFoundException('User not found')
      }

      const tenant = await this.tenantRepository.findActiveById(tenantId, client)
      if (!tenant) {
        throw new BadRequestException('Operation is inactive or unavailable')
      }

      const created = await this.tenantRepository.insertMemberIfAbsent(
        tenant.id,
        user.id,
        'member',
        client
      )

      return { created, operation: tenant.name }
    })
  }
}

import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import IRole from '#modules/roles/interfaces/role_interface'
import RolesRepository from '#modules/roles/repositories/roles_repository'
import Tenant from '#modules/tenants/models/tenant'
import CreateTenantService from '#modules/tenants/services/create_tenant_service'
import type IUser from '#modules/users/interfaces/user_interface'
import UsersRepository from '#modules/users/repositories/users_repository'
import { mapUserUniqueConstraintError } from '#modules/users/utils/user_unique_constraint_error'

export type CreateUserOptions = {
  createPersonalWorkspace?: boolean
  attachTenantId?: number
}

@inject()
export default class CreateUserService {
  constructor(
    private usersRepository: UsersRepository,
    private rolesRepository: RolesRepository,
    private createTenantService: CreateTenantService
  ) {}

  async run(payload: IUser.CreatePayload, options: CreateUserOptions = {}) {
    if (options.createPersonalWorkspace && options.attachTenantId) {
      throw new BadRequestException('Registration cannot create and join workspaces simultaneously')
    }

    try {
      return await db.transaction(async (client) => {
        const user = await this.usersRepository.create(payload, { client })
        const defaultRole = await this.rolesRepository.findBy('slug', IRole.Slugs.USER, { client })

        if (defaultRole) {
          await user.related('roles').attach([defaultRole.id], client)
        }

        if (options.createPersonalWorkspace) {
          await this.createTenantService.run(
            user.id,
            {
              name: `${user.full_name}'s Workspace`,
              slug: `workspace-${user.id}`,
            },
            client
          )
        }

        if (options.attachTenantId) {
          const tenant = await Tenant.query({ client })
            .where('id', options.attachTenantId)
            .where('is_active', true)
            .first()

          if (!tenant) {
            throw new BadRequestException('Public operation is inactive or unavailable')
          }

          const now = new Date()
          await client.table('user_tenants').insert({
            user_id: user.id,
            tenant_id: tenant.id,
            role: 'member',
            created_at: now,
            updated_at: now,
          })
        }

        return user
      })
    } catch (error) {
      throw mapUserUniqueConstraintError(error, ['email', 'username'])
    }
  }
}

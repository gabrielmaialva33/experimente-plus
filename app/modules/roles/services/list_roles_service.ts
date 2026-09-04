import { inject } from '@adonisjs/core'

import RolesRepository from '#modules/roles/repositories/roles_repository'
import type { OrderDirection } from '#shared/lucid/lucid_repository_interface'

interface ListRolesOptions {
  page?: number
  perPage?: number
  sortBy?: string
  direction?: OrderDirection
}

@inject()
export default class ListRolesService {
  constructor(private rolesRepository: RolesRepository) {}

  async run(options: ListRolesOptions = {}) {
    return this.rolesRepository.paginate({
      page: options.page ?? 1,
      perPage: options.perPage ?? 10,
      sortBy: options.sortBy ?? 'id',
      direction: options.direction ?? 'asc',
    })
  }
}

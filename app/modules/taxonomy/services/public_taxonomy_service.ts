import { inject } from '@adonisjs/core'

import CategoryFamily from '#modules/taxonomy/models/category_family'
import CategoryFamilyRepository from '#modules/taxonomy/repositories/category_family_repository'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class PublicTaxonomyService {
  constructor(
    private operationResolver: PublicOperationResolver,
    private categoryFamilyRepository: CategoryFamilyRepository
  ) {}

  async tree(hostname?: string | null): Promise<CategoryFamily[]> {
    const tenant = await this.operationResolver.resolve(hostname)
    return this.categoryFamilyRepository.listPublicTree(tenant.id)
  }
}

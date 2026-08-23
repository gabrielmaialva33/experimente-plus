import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CategoryFamilyService from '#modules/taxonomy/services/category_family_service'
import {
  createCategoryFamilyValidator,
  listCategoryFamiliesValidator,
  updateCategoryFamilyValidator,
} from '#modules/taxonomy/validators/taxonomy_validator'

@inject()
export default class CategoryFamiliesController {
  constructor(private categoryFamilyService: CategoryFamilyService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listCategoryFamiliesValidator)
    const families = await this.categoryFamilyService.list(
      tenant!.id,
      query.include_inactive ?? false
    )
    return response.ok(families)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCategoryFamilyValidator)
    const family = await this.categoryFamilyService.create(tenant!.id, payload)
    return response.created(family)
  }

  async show({ params, response, tenant }: HttpContext) {
    const family = await this.categoryFamilyService.show(tenant!.id, Number(params.id))
    return response.ok(family)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCategoryFamilyValidator)
    const family = await this.categoryFamilyService.update(tenant!.id, Number(params.id), payload)
    return response.ok(family)
  }
}

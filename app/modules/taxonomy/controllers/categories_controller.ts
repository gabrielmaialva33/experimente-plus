import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CategoryService from '#modules/taxonomy/services/category_service'
import {
  createCategoryValidator,
  listCategoriesValidator,
  updateCategoryValidator,
} from '#modules/taxonomy/validators/taxonomy_validator'

@inject()
export default class CategoriesController {
  constructor(private categoryService: CategoryService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listCategoriesValidator)
    const categories = await this.categoryService.list(tenant!.id, {
      includeInactive: query.include_inactive ?? false,
      familyId: query.family_id,
      parentId: query.parent_id,
    })
    return response.ok(categories)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)
    const category = await this.categoryService.create(tenant!.id, payload)
    return response.created(category)
  }

  async show({ params, response, tenant }: HttpContext) {
    const category = await this.categoryService.show(tenant!.id, Number(params.id))
    return response.ok(category)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCategoryValidator)
    const category = await this.categoryService.update(tenant!.id, Number(params.id), payload)
    return response.ok(category)
  }
}

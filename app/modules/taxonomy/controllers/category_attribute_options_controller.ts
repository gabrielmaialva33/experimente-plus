import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CategoryAttributeOptionService from '#modules/taxonomy/services/category_attribute_option_service'
import {
  createAttributeOptionValidator,
  listAttributeOptionsValidator,
  updateAttributeOptionValidator,
} from '#modules/taxonomy/validators/taxonomy_validator'

@inject()
export default class CategoryAttributeOptionsController {
  constructor(private optionService: CategoryAttributeOptionService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listAttributeOptionsValidator)
    const options = await this.optionService.list(
      tenant!.id,
      query.attribute_definition_id,
      query.include_inactive ?? false
    )
    return response.ok(options)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createAttributeOptionValidator)
    const option = await this.optionService.create(tenant!.id, payload)
    return response.created(option)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateAttributeOptionValidator)
    const option = await this.optionService.update(tenant!.id, Number(params.id), payload)
    return response.ok(option)
  }
}

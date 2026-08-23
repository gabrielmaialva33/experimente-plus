import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CategoryAttributeDefinitionService from '#modules/taxonomy/services/category_attribute_definition_service'
import {
  createAttributeDefinitionValidator,
  listAttributeDefinitionsValidator,
  updateAttributeDefinitionValidator,
} from '#modules/taxonomy/validators/taxonomy_validator'

@inject()
export default class CategoryAttributeDefinitionsController {
  constructor(private definitionService: CategoryAttributeDefinitionService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listAttributeDefinitionsValidator)
    const definitions = await this.definitionService.list(tenant!.id, {
      categoryId: query.category_id,
      includeInactive: query.include_inactive ?? false,
    })
    return response.ok(definitions)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createAttributeDefinitionValidator)
    const definition = await this.definitionService.create(tenant!.id, payload)
    return response.created(definition)
  }

  async show({ params, response, tenant }: HttpContext) {
    const definition = await this.definitionService.show(tenant!.id, Number(params.id))
    return response.ok(definition)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateAttributeDefinitionValidator)
    const definition = await this.definitionService.update(tenant!.id, Number(params.id), payload)
    return response.ok(definition)
  }
}

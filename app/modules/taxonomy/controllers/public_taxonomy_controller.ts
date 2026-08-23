import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import PublicTaxonomyService from '#modules/taxonomy/services/public_taxonomy_service'

@inject()
export default class PublicTaxonomyController {
  constructor(private publicTaxonomyService: PublicTaxonomyService) {}

  async tree({ request, response }: HttpContext) {
    const families = await this.publicTaxonomyService.tree(request.hostname())
    return response.ok(families)
  }
}

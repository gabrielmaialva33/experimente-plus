import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CatalogService from '#modules/catalog/services/catalog_service'
import {
  catalogDefaults,
  catalogSearchValidator,
} from '#modules/catalog/validators/catalog_validator'

@inject()
export default class CatalogController {
  constructor(private catalogService: CatalogService) {}

  async cities({ request, response }: HttpContext) {
    const cities = await this.catalogService.cities(request.hostname())
    this.publicCache(response, 300)
    return response.ok(cities)
  }

  async categories({ params, request, response }: HttpContext) {
    const categories = await this.catalogService.categories(
      request.hostname(),
      String(params.citySlug)
    )
    this.publicCache(response, 300)
    return response.ok(categories)
  }

  async index({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(catalogSearchValidator)
    const result = await this.catalogService.search(request.hostname(), String(params.citySlug), {
      q: payload.q ?? '',
      category: payload.category,
      open_now: payload.open_now ?? catalogDefaults.open_now,
      attributes: payload.attributes ?? catalogDefaults.attributes,
      page: payload.page ?? catalogDefaults.page,
      per_page: payload.per_page ?? catalogDefaults.per_page,
      sort: payload.sort ?? catalogDefaults.sort,
    })

    this.publicCache(response, 60)
    return response.ok(result)
  }

  async filters({ params, request, response }: HttpContext) {
    const filters = await this.catalogService.filters(request.hostname(), String(params.citySlug))
    this.publicCache(response, 300)
    return response.ok(filters)
  }

  async show({ params, request, response }: HttpContext) {
    const establishment = await this.catalogService.show(
      request.hostname(),
      String(params.citySlug),
      String(params.establishmentSlug)
    )
    this.publicCache(response, 300)
    return response.ok(establishment)
  }

  private publicCache(response: HttpContext['response'], maxAge: number): void {
    response.header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    )
    response.vary(['Host', 'Accept-Encoding'])
  }
}

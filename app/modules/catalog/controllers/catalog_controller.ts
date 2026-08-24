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
    const cities = await this.catalogService.cities(this.hostname(request))
    this.publicCache(response, 300)
    return response.ok(cities)
  }

  async categories({ params, request, response }: HttpContext) {
    const categories = await this.catalogService.categories(
      this.hostname(request),
      String(params.citySlug)
    )
    this.publicCache(response, 300)
    return response.ok(categories)
  }

  async index({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(catalogSearchValidator)
    const result = await this.catalogService.search(
      this.hostname(request),
      String(params.citySlug),
      {
        q: payload.q ?? '',
        category: payload.category,
        open_now: payload.open_now ?? catalogDefaults.open_now,
        page: payload.page ?? catalogDefaults.page,
        per_page: payload.per_page ?? catalogDefaults.per_page,
        sort: payload.sort ?? catalogDefaults.sort,
      }
    )

    this.publicCache(response, 60)
    return response.ok(result)
  }

  async show({ params, request, response }: HttpContext) {
    const establishment = await this.catalogService.show(
      this.hostname(request),
      String(params.citySlug),
      String(params.establishmentSlug)
    )
    this.publicCache(response, 300)
    return response.ok(establishment)
  }

  private hostname(request: HttpContext['request']): string {
    const forwardedHost = request.header('x-forwarded-host')?.split(',')[0]?.trim()
    const rawHost = request.header('host')?.split(',')[0]?.trim()
    const resolvedHost = forwardedHost ?? rawHost ?? request.hostname() ?? ''

    return resolvedHost.replace(/:\d+$/, '')
  }

  private publicCache(response: HttpContext['response'], maxAge: number): void {
    response.header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    )
    response.header('Vary', 'Host, Accept-Encoding')
  }
}

import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CatalogService from '#modules/catalog/services/catalog_service'
import {
  catalogDefaults,
  catalogSearchValidator,
} from '#modules/catalog/validators/catalog_validator'

@inject()
export default class CatalogPagesController {
  constructor(private catalogService: CatalogService) {}

  async cities({ inertia, request, response }: HttpContext) {
    const cities = await this.catalogService.cities(this.hostname(request))
    this.publicCache(response, 300)
    return inertia.render('catalog/cities', {
      catalog: cities,
    })
  }

  async categories({ inertia, params, request, response }: HttpContext) {
    const categories = await this.catalogService.categories(
      this.hostname(request),
      String(params.citySlug)
    )
    this.publicCache(response, 300)
    return inertia.render('catalog/categories', {
      catalog: categories,
      city_slug: params.citySlug ?? null,
    })
  }

  async index({ inertia, params, request, response }: HttpContext) {
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
    return inertia.render('catalog/establishments', {
      catalog: result,
      city_slug: params.citySlug ?? null,
    })
  }

  async indexByCategory({ inertia, params, request, response }: HttpContext) {
    const payload = {
      ...(await request.validateUsing(catalogSearchValidator)),
      category_slug: params.categorySlug,
    }
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
    return inertia.render('catalog/category', {
      catalog: result,
      city_slug: params.citySlug ?? null,
      category_slug: params.categorySlug ?? null,
    })
  }

  async show({ inertia, params, request, response }: HttpContext) {
    const establishment = await this.catalogService.show(
      this.hostname(request),
      String(params.citySlug),
      String(params.establishmentSlug)
    )
    this.publicCache(response, 300)
    return inertia.render('catalog/establishment', {
      catalog: establishment,
      city_slug: params.citySlug ?? null,
    })
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

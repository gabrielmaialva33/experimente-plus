import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import NotFoundException from '#exceptions/not_found_exception'
import CatalogService from '#modules/catalog/services/catalog_service'
import {
  catalogDefaults,
  catalogSearchValidator,
} from '#modules/catalog/validators/catalog_validator'

@inject()
export default class CatalogPagesController {
  constructor(private catalogService: CatalogService) {}

  async cities({ inertia, request, response }: HttpContext) {
    const cities = await this.catalogService.cities(request.hostname())
    this.publicCache(response, 300)
    return inertia.render('catalog/cities', {
      catalog: cities,
    })
  }

  async categories({ inertia, params, request, response }: HttpContext) {
    const categories = await this.catalogService.categories(
      request.hostname(),
      String(params.citySlug)
    )
    this.publicCache(response, 300)
    return inertia.render('catalog/categories', {
      catalog: categories,
      city_slug: categories.city.slug,
    })
  }

  async index({ inertia, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(catalogSearchValidator)
    const hostname = request.hostname()
    const citySlug = String(params.citySlug)
    const query = {
      q: payload.q ?? '',
      category: payload.category,
      open_now: payload.open_now ?? catalogDefaults.open_now,
      page: payload.page ?? catalogDefaults.page,
      per_page: payload.per_page ?? catalogDefaults.per_page,
      sort: payload.sort ?? catalogDefaults.sort,
    }
    // These reads can share a transaction-bound connection. Serializing them
    // keeps the request compatible with node-postgres 9 and transactional callers.
    const result = await this.catalogService.search(hostname, citySlug, query)
    const filterCategories = await this.catalogService.categories(hostname, citySlug)

    this.publicCache(response, 60)
    return inertia.render('catalog/establishments', {
      catalog: result,
      city_slug: result.context.city.slug,
      filter_categories: filterCategories,
    })
  }

  async indexByCategory({ inertia, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(catalogSearchValidator)
    const categorySlug = String(params.categorySlug)
    const result = await this.catalogService.search(request.hostname(), String(params.citySlug), {
      q: payload.q ?? '',
      category: categorySlug,
      open_now: payload.open_now ?? catalogDefaults.open_now,
      page: payload.page ?? catalogDefaults.page,
      per_page: payload.per_page ?? catalogDefaults.per_page,
      sort: payload.sort ?? catalogDefaults.sort,
    })
    const category = result.context.category

    // The search endpoint intentionally represents an unknown category with an
    // empty result. A canonical category page, however, must not be indexable
    // when its route identity does not exist.
    if (!category) {
      throw new NotFoundException('Category not found')
    }

    this.publicCache(response, 60)
    return inertia.render('catalog/category', {
      catalog: result,
      city_slug: result.context.city.slug,
      category_slug: category.slug,
    })
  }

  async show({ inertia, params, request, response }: HttpContext) {
    const establishment = await this.catalogService.show(
      request.hostname(),
      String(params.citySlug),
      String(params.establishmentSlug)
    )
    this.publicCache(response, 300)
    return inertia.render('catalog/establishment', {
      catalog: establishment,
      city_slug: establishment.city.slug,
    })
  }

  private publicCache(response: HttpContext['response'], maxAge: number): void {
    response.header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    )
    response.header('Vary', 'Host, Accept-Encoding')
  }
}

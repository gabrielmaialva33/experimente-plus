import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import NotFoundException from '#exceptions/not_found_exception'
import CatalogService from '#modules/catalog/services/catalog_service'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import CityAgendaService from '#modules/partner_content/services/city_agenda_service'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'
import {
  catalogDefaults,
  catalogSearchValidator,
} from '#modules/catalog/validators/catalog_validator'

@inject()
export default class CatalogPagesController {
  constructor(
    private catalogService: CatalogService,
    private partnerContentService: PartnerContentService,
    private partnerContentMediaService: PartnerContentMediaService,
    private cityAgendaService: CityAgendaService,
    private publicOperationResolver: PublicOperationResolver
  ) {}

  async cities({ inertia, request, response }: HttpContext) {
    this.publicCache(response, 300)
    const cities = await this.catalogService.cities(request.hostname())
    return inertia.render('catalog/cities', {
      catalog: cities,
    })
  }

  async categories({ inertia, params, request, response }: HttpContext) {
    this.publicCache(response, 300)
    const categories = await this.catalogService.categories(
      request.hostname(),
      String(params.citySlug)
    )
    return inertia.render('catalog/categories', {
      catalog: categories,
      city_slug: categories.city.slug,
    })
  }

  async index({ inertia, params, request, response }: HttpContext) {
    this.publicCache(response, 60)
    const payload = await request.validateUsing(catalogSearchValidator)
    const hostname = request.hostname()
    const citySlug = String(params.citySlug)
    const query = {
      q: payload.q ?? '',
      category: payload.category,
      open_now: payload.open_now ?? catalogDefaults.open_now,
      attributes: payload.attributes ?? catalogDefaults.attributes,
      page: payload.page ?? catalogDefaults.page,
      per_page: payload.per_page ?? catalogDefaults.per_page,
      sort: payload.sort ?? catalogDefaults.sort,
    }
    // These reads can share a transaction-bound connection. Serializing them
    // keeps the request compatible with node-postgres 9 and transactional callers.
    const result = await this.catalogService.search(hostname, citySlug, query)
    const filterCategories = await this.catalogService.categories(hostname, citySlug)
    const cityAgenda = this.isCityLanding(query)
      ? await this.cityAgendaService.forCity(hostname, result.context.city.slug)
      : null

    return inertia.render('catalog/establishments', {
      catalog: result,
      city_slug: result.context.city.slug,
      filter_categories: filterCategories,
      city_agenda: cityAgenda,
    })
  }

  async indexByCategory({ inertia, params, request, response }: HttpContext) {
    this.publicCache(response, 60)
    const payload = await request.validateUsing(catalogSearchValidator)
    const categorySlug = String(params.categorySlug)
    const result = await this.catalogService.search(request.hostname(), String(params.citySlug), {
      q: payload.q ?? '',
      category: categorySlug,
      open_now: payload.open_now ?? catalogDefaults.open_now,
      attributes: payload.attributes ?? catalogDefaults.attributes,
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

    return inertia.render('catalog/category', {
      catalog: result,
      city_slug: result.context.city.slug,
      category_slug: category.slug,
    })
  }

  async show({ inertia, params, request, response }: HttpContext) {
    this.publicCache(response, 300)
    const hostname = request.hostname()
    const establishment = await this.catalogService.show(
      hostname,
      String(params.citySlug),
      String(params.establishmentSlug)
    )
    const partnerContent =
      'historical' in establishment
        ? { experiences: [], events: [], showcase_items: [] }
        : await this.publicPartnerContent(hostname, establishment.id)

    return inertia.render('catalog/establishment', {
      catalog: establishment,
      city_slug: establishment.city.slug,
      partner_content: partnerContent,
    })
  }

  private async publicPartnerContent(
    hostname: string | null,
    establishmentId: number
  ): Promise<{
    experiences: IPartnerContent.PublicProjection[]
    events: IPartnerContent.PublicProjection[]
    showcase_items: IPartnerContent.PublicProjection[]
  }> {
    const tenant = await this.publicOperationResolver.resolve(hostname)

    // Keep these reads serial. Functional suites may execute inside a
    // transaction-bound pg connection that must not carry concurrent queries.
    const experiences = await this.partnerContentService.listPublic(
      'experience',
      tenant.id,
      establishmentId
    )
    const events = await this.partnerContentService.listPublic('event', tenant.id, establishmentId)
    const showcaseItems = await this.partnerContentService.listPublic(
      'showcase_item',
      tenant.id,
      establishmentId
    )

    return {
      experiences: await this.partnerContentMediaService.projectPublicContents(
        'experience',
        tenant.id,
        experiences
      ),
      events: await this.partnerContentMediaService.projectPublicContents(
        'event',
        tenant.id,
        events
      ),
      showcase_items: await this.partnerContentMediaService.projectPublicContents(
        'showcase_item',
        tenant.id,
        showcaseItems
      ),
    }
  }

  /**
   * Whether this request is the city's landing view.
   *
   * The agenda belongs to the page someone arrives at, not to a result set they
   * narrowed down: a visitor who typed a term or picked a category asked a
   * question, and answering it with three unrelated bands would bury the answer.
   * The rule lives here rather than in the component so the extra reads are not
   * paid for at all when they would not be shown.
   */
  private isCityLanding(query: {
    q: string
    category?: string
    open_now: boolean
    attributes: string[]
    page: number
  }): boolean {
    return (
      query.page === 1 &&
      query.q.trim() === '' &&
      !query.category &&
      !query.open_now &&
      query.attributes.length === 0
    )
  }

  private publicCache(response: HttpContext['response'], maxAge: number): void {
    response.header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    )
    // The same URL serves the initial HTML document and the Inertia JSON page.
    // They must never share a browser/CDN cache entry.
    response.vary(['Host', 'X-Inertia', 'Accept-Encoding'])
  }
}

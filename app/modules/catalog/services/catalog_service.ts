import { inject } from '@adonisjs/core'

import NotFoundException from '#exceptions/not_found_exception'
import type ICatalog from '#modules/catalog/interfaces/catalog_interface'
import CatalogSearchRepository from '#modules/catalog/repositories/catalog_search_repository'
import CatalogCacheService from '#modules/catalog/services/catalog_cache_service'
import CityRepository from '#modules/geography/repositories/city_repository'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class CatalogService {
  constructor(
    private operationResolver: PublicOperationResolver,
    private cityRepository: CityRepository,
    private catalogRepository: CatalogSearchRepository,
    private cacheService: CatalogCacheService
  ) {}

  async cities(hostname: string | null): Promise<ICatalog.CityProjection[]> {
    const tenant = await this.operationResolver.resolve(hostname)
    const projectionVersion = await this.catalogRepository.getProjectionVersion(tenant.id)
    const cacheKey = this.cacheService.key(['cities', tenant.id, projectionVersion])

    return this.cacheService.remember(cacheKey, 300, async () => {
      const cities = await this.catalogRepository.listCities(tenant.id)

      return cities.map((city) => ({
        slug: city.slug,
        name: city.name,
        state_code: city.state_code,
        country_code: city.country_code,
        timezone: city.timezone,
        coordinates: {
          latitude: city.latitude,
          longitude: city.longitude,
        },
        region: {
          slug: city.region_slug,
          name: city.region_name,
        },
        establishments_count: city.establishments_count,
      }))
    })
  }

  async categories(
    hostname: string | null,
    citySlug: string
  ): Promise<{
    city: Pick<ICatalog.CityProjection, 'slug' | 'name' | 'state_code' | 'timezone'>
    categories: ICatalog.CategoryProjection[]
  }> {
    const { tenantId, city } = await this.resolveCity(hostname, citySlug)
    const projectionVersion = await this.catalogRepository.getProjectionVersion(tenantId)
    const cacheKey = this.cacheService.key([
      'city-categories',
      tenantId,
      projectionVersion,
      city.slug,
    ])

    return this.cacheService.remember(cacheKey, 300, async () => {
      const categories = await this.catalogRepository.listCategories(tenantId, city.id)

      return {
        city: {
          slug: city.slug,
          name: city.name,
          state_code: city.state_code,
          timezone: city.timezone,
        },
        categories: categories.map((category) => ({
          slug: category.slug,
          name: category.name,
          description: category.description,
          icon: category.icon,
          parent_slug: category.parent_slug,
          family: {
            slug: category.family_slug,
            name: category.family_name,
            icon: category.family_icon,
          },
          establishments_count: category.establishments_count,
        })),
      }
    })
  }

  async search(
    hostname: string | null,
    citySlug: string,
    query: ICatalog.SearchQuery
  ): Promise<ICatalog.SearchResult> {
    const { tenantId, city } = await this.resolveCity(hostname, citySlug)
    const projectionVersion = await this.catalogRepository.getProjectionVersion(tenantId)
    const normalizedQuery: ICatalog.SearchQuery = {
      ...query,
      q: query.q.trim(),
    }
    const cacheKey = this.cacheService.key([
      'search',
      tenantId,
      projectionVersion,
      city.slug,
      normalizedQuery.q,
      normalizedQuery.category ?? null,
      normalizedQuery.open_now,
      normalizedQuery.page,
      normalizedQuery.per_page,
      normalizedQuery.sort,
    ])

    return this.cacheService.remember(cacheKey, 60, async () => {
      const [organicRows, sponsoredRows] = await Promise.all([
        this.catalogRepository.searchOrganic(tenantId, city.id, normalizedQuery),
        this.catalogRepository.searchSponsored(tenantId, city.id, normalizedQuery),
      ])
      const total = organicRows[0]?.total_count ?? 0
      const lastPage = Math.max(1, Math.ceil(total / normalizedQuery.per_page))

      return {
        meta: {
          total,
          page: normalizedQuery.page,
          per_page: normalizedQuery.per_page,
          last_page: lastPage,
          first_page: 1,
          first_page_url: this.pageUrl(city.slug, normalizedQuery, 1),
          last_page_url: this.pageUrl(city.slug, normalizedQuery, lastPage),
          next_page_url:
            normalizedQuery.page < lastPage
              ? this.pageUrl(city.slug, normalizedQuery, normalizedQuery.page + 1)
              : null,
          previous_page_url:
            normalizedQuery.page > 1
              ? this.pageUrl(city.slug, normalizedQuery, normalizedQuery.page - 1)
              : null,
        },
        query: {
          q: normalizedQuery.q || null,
          category: normalizedQuery.category ?? null,
          open_now: normalizedQuery.open_now,
          sort: normalizedQuery.sort,
        },
        sponsored_results: sponsoredRows.flatMap((row) => {
          const item = this.searchItem(row)
          return item ? [item] : []
        }),
        organic_results: organicRows.flatMap((row) => {
          const item = this.searchItem(row)
          return item ? [item] : []
        }),
      }
    })
  }

  async show(
    hostname: string | null,
    citySlug: string,
    establishmentSlug: string
  ): Promise<ICatalog.DetailProjection | ICatalog.HistoricalProjection> {
    const { tenantId, city } = await this.resolveCity(hostname, citySlug)
    const projectionVersion = await this.catalogRepository.getProjectionVersion(tenantId)
    const normalizedSlug = this.requireSlug(establishmentSlug)
    const cacheKey = this.cacheService.key([
      'detail',
      tenantId,
      projectionVersion,
      city.slug,
      normalizedSlug,
    ])

    return this.cacheService.remember(cacheKey, 300, async () => {
      const row = await this.catalogRepository.findBySlug(tenantId, city.id, normalizedSlug)

      if (!row) {
        throw new NotFoundException('Published establishment not found')
      }

      if (row.business_status === 'permanently_closed') {
        return {
          slug: row.establishment_slug,
          name: row.public_name,
          city: {
            slug: row.city_slug,
            name: row.city_name,
            state_code: row.city_state_code,
          },
          business_status: 'permanently_closed',
          historical: true,
          message: 'Este estabelecimento encerrou permanentemente as atividades.',
          published_at: row.published_at,
          updated_at: row.public_updated_at,
        }
      }

      if (!row.is_discoverable || !row.cover_media) {
        throw new NotFoundException('Published establishment not found')
      }

      return {
        slug: row.establishment_slug,
        name: row.public_name,
        short_description: row.short_description,
        description: row.description,
        city: {
          slug: row.city_slug,
          name: row.city_name,
          state_code: row.city_state_code,
          timezone: row.city_timezone,
        },
        address: row.address,
        contacts: {
          phone: row.public_phone,
          whatsapp: row.whatsapp,
          email: row.public_email,
          website: row.website,
          instagram: row.instagram,
          booking_url: row.booking_url,
        },
        business_status: row.business_status,
        availability_type: row.availability_type,
        is_open_now: row.is_open_now,
        categories: row.categories,
        attributes: row.public_attributes,
        opening_hours: {
          weekly: row.weekly_hours,
          special_days: row.special_days,
        },
        media: row.media,
        cover: row.cover_media,
        is_sponsored: row.is_sponsored,
        published_at: row.published_at,
        updated_at: row.public_updated_at,
      }
    })
  }

  private async resolveCity(hostname: string | null, citySlug: string) {
    const tenant = await this.operationResolver.resolve(hostname)
    const normalizedSlug = this.requireSlug(citySlug)
    const city = await this.cityRepository.findBySlugForTenant(tenant.id, normalizedSlug)

    if (!city || !city.is_active || !city.region?.is_active) {
      throw new NotFoundException('City not found')
    }

    return { tenantId: tenant.id, city }
  }

  private searchItem(row: ICatalog.CatalogRow): ICatalog.SearchItemProjection | null {
    if (!row.cover_media) {
      return null
    }

    return {
      slug: row.establishment_slug,
      name: row.public_name,
      short_description: row.short_description,
      city: {
        slug: row.city_slug,
        name: row.city_name,
        state_code: row.city_state_code,
      },
      address: {
        district: row.address.district,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      business_status: row.business_status,
      is_open_now: row.is_open_now,
      primary_category: row.categories.find((category) => category.is_primary) ?? null,
      categories: row.categories,
      cover: row.cover_media,
      is_sponsored: row.is_sponsored,
      published_at: row.published_at,
      updated_at: row.public_updated_at,
    }
  }

  private requireSlug(value: string): string {
    const normalized = value.trim().toLowerCase()

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new NotFoundException('Public resource not found')
    }

    return normalized
  }

  private pageUrl(citySlug: string, query: ICatalog.SearchQuery, page: number): string {
    const parameters = new URLSearchParams()

    if (query.q) parameters.set('q', query.q)
    if (query.category) parameters.set('category', query.category)
    if (query.open_now) parameters.set('open_now', 'true')
    if (query.sort !== 'relevance') parameters.set('sort', query.sort)
    if (query.per_page !== 20) parameters.set('per_page', String(query.per_page))
    parameters.set('page', String(page))

    return `/api/v1/catalog/cities/${citySlug}/establishments?${parameters.toString()}`
  }
}

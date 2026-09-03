import { test } from '@japa/runner'

import type CatalogSearchRepository from '#modules/catalog/repositories/catalog_search_repository'
import type CatalogCacheService from '#modules/catalog/services/catalog_cache_service'
import CatalogService from '#modules/catalog/services/catalog_service'
import type CityRepository from '#modules/geography/repositories/city_repository'
import type PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

test.group('CatalogService', () => {
  test('returns the canonical empty result without searching for an unknown category', async ({
    assert,
  }) => {
    const searchCalls = { organic: 0, sponsored: 0 }
    let cacheParts: Array<string | number | boolean | null | undefined> = []

    const operationResolver = {
      async resolve() {
        return { id: 17 }
      },
    } as unknown as PublicOperationResolver
    const cityRepository = {
      async findBySlugForTenant() {
        return {
          id: 29,
          slug: 'cornelio-procopio',
          name: 'Cornélio Procópio',
          state_code: 'PR',
          timezone: 'America/Sao_Paulo',
          is_active: true,
          region: { is_active: true },
        }
      },
    } as unknown as CityRepository
    const catalogRepository = {
      async getProjectionVersion() {
        return 11
      },
      async findActiveCategoryBySlug() {
        return null
      },
      async searchOrganic() {
        searchCalls.organic += 1
        return { rows: [], total: 0, page: 1 }
      },
      async searchSponsored() {
        searchCalls.sponsored += 1
        return []
      },
    } as unknown as CatalogSearchRepository
    const cacheService = {
      key(parts: Array<string | number | boolean | null | undefined>) {
        cacheParts = parts
        return JSON.stringify(parts)
      },
      async remember<T>(_key: string, _ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
        return factory()
      },
    } as unknown as CatalogCacheService
    const service = new CatalogService(
      operationResolver,
      cityRepository,
      catalogRepository,
      cacheService
    )

    const result = await service.search('piloto.experimente.test', 'Cornelio-Procopio', {
      q: '  café  ',
      category: 'Categoria-Inexistente',
      open_now: true,
      page: 3,
      per_page: 12,
      sort: 'recent',
    })

    assert.deepEqual(searchCalls, { organic: 0, sponsored: 0 })
    assert.include(cacheParts, 'categoria-inexistente')
    assert.deepEqual(result.context, {
      city: {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        state_code: 'PR',
        timezone: 'America/Sao_Paulo',
      },
      category: null,
    })
    assert.deepEqual(result.query, {
      q: 'café',
      category: 'categoria-inexistente',
      open_now: true,
      sort: 'recent',
    })
    assert.deepEqual(result.sponsored_results, [])
    assert.deepEqual(result.organic_results, [])
    assert.deepInclude(result.meta, {
      total: 0,
      page: 1,
      per_page: 12,
      last_page: 1,
      first_page: 1,
      next_page_url: null,
      previous_page_url: null,
    })
    assert.equal(
      result.meta.first_page_url,
      '/api/v1/catalog/cities/cornelio-procopio/establishments?q=caf%C3%A9&category=categoria-inexistente&open_now=true&sort=recent&per_page=12&page=1'
    )
    assert.equal(result.meta.last_page_url, result.meta.first_page_url)
  })

  test('uses the effective page returned by the repository for pagination metadata', async ({
    assert,
  }) => {
    const operationResolver = {
      async resolve() {
        return { id: 17 }
      },
    } as unknown as PublicOperationResolver
    const cityRepository = {
      async findBySlugForTenant() {
        return {
          id: 29,
          slug: 'cornelio-procopio',
          name: 'Cornélio Procópio',
          state_code: 'PR',
          timezone: 'America/Sao_Paulo',
          is_active: true,
          region: { is_active: true },
        }
      },
    } as unknown as CityRepository
    const catalogRepository = {
      async getProjectionVersion() {
        return 11
      },
      async findActiveCategoryBySlug() {
        return null
      },
      async searchOrganic() {
        return { rows: [], total: 21, page: 3 }
      },
      async searchSponsored() {
        return []
      },
    } as unknown as CatalogSearchRepository
    const cacheService = {
      key(parts: Array<string | number | boolean | null | undefined>) {
        return JSON.stringify(parts)
      },
      async remember<T>(_key: string, _ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
        return factory()
      },
    } as unknown as CatalogCacheService
    const service = new CatalogService(
      operationResolver,
      cityRepository,
      catalogRepository,
      cacheService
    )

    const result = await service.search('piloto.experimente.test', 'cornelio-procopio', {
      q: '',
      open_now: false,
      page: 4,
      per_page: 10,
      sort: 'name',
    })

    assert.deepInclude(result.meta, {
      total: 21,
      page: 3,
      per_page: 10,
      last_page: 3,
      next_page_url: null,
    })
    assert.equal(
      result.meta.previous_page_url,
      '/api/v1/catalog/cities/cornelio-procopio/establishments?sort=name&per_page=10&page=2'
    )
    assert.equal(
      result.meta.last_page_url,
      '/api/v1/catalog/cities/cornelio-procopio/establishments?sort=name&per_page=10&page=3'
    )
    assert.deepEqual(result.organic_results, [])
  })

  test('keeps the canonical identity for a valid category with no establishments', async ({
    assert,
  }) => {
    const operationResolver = {
      async resolve() {
        return { id: 17 }
      },
    } as unknown as PublicOperationResolver
    const cityRepository = {
      async findBySlugForTenant() {
        return {
          id: 29,
          slug: 'cornelio-procopio',
          name: 'Cornélio Procópio',
          state_code: 'PR',
          timezone: 'America/Sao_Paulo',
          is_active: true,
          region: { is_active: true },
        }
      },
    } as unknown as CityRepository
    const catalogRepository = {
      async getProjectionVersion() {
        return 11
      },
      async findActiveCategoryBySlug() {
        return {
          slug: 'cinemas',
          name: 'Cinemas',
          description: 'Salas de cinema da região.',
          icon: 'film',
          parent_slug: null,
          family_slug: 'cultura',
          family_name: 'Cultura',
          family_icon: 'theater',
        }
      },
      async searchOrganic() {
        return { rows: [], total: 0, page: 1 }
      },
      async searchSponsored() {
        return []
      },
    } as unknown as CatalogSearchRepository
    const cacheService = {
      key(parts: Array<string | number | boolean | null | undefined>) {
        return JSON.stringify(parts)
      },
      async remember<T>(_key: string, _ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
        return factory()
      },
    } as unknown as CatalogCacheService
    const service = new CatalogService(
      operationResolver,
      cityRepository,
      catalogRepository,
      cacheService
    )

    const result = await service.search('piloto.experimente.test', 'cornelio-procopio', {
      q: '',
      category: 'cinemas',
      open_now: false,
      page: 1,
      per_page: 20,
      sort: 'relevance',
    })

    assert.deepEqual(result.context.category, {
      slug: 'cinemas',
      name: 'Cinemas',
      description: 'Salas de cinema da região.',
      icon: 'film',
      parent_slug: null,
      family: {
        slug: 'cultura',
        name: 'Cultura',
        icon: 'theater',
      },
    })
    assert.deepInclude(result.meta, {
      total: 0,
      page: 1,
      last_page: 1,
      next_page_url: null,
      previous_page_url: null,
    })
    assert.deepEqual(result.sponsored_results, [])
    assert.deepEqual(result.organic_results, [])
  })
})

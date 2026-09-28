import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import City from '#modules/geography/models/city'

export default class CityRepository {
  async listByTenant(
    tenantId: number,
    options: { includeInactive?: boolean; regionId?: number } = {}
  ): Promise<City[]> {
    const query = City.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .preload('region')

    if (!options.includeInactive) {
      query.where('is_active', true)
    }

    if (options.regionId !== undefined) {
      query.where('region_id', options.regionId)
    }

    return query
  }

  /** Active cities in display order, without relations, for form choices. */
  async listActiveForTenant(tenantId: number): Promise<City[]> {
    return City.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
  }

  async listPublic(tenantId: number): Promise<City[]> {
    return City.query()
      .where('cities.tenant_id', tenantId)
      .where('cities.is_active', true)
      .whereHas('region', (query) => query.where('is_active', true))
      .orderBy('cities.sort_order', 'asc')
      .orderBy('cities.name', 'asc')
      .preload('region')
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<City | null> {
    return City.query().where('tenant_id', tenantId).where('id', id).preload('region').first()
  }

  async findActiveByIdForTenant(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<City | null> {
    return City.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .where('is_active', true)
      .first()
  }

  async listActiveByIdsForTenant(tenantId: number, ids: readonly number[]): Promise<City[]> {
    return City.query()
      .where('tenant_id', tenantId)
      .whereIn('id', [...ids])
      .where('is_active', true)
  }

  /** Only id, name, state and timezone: what a form needs to label a place's city. */
  async listSummariesByIdsForTenant(tenantId: number, ids: readonly number[]): Promise<City[]> {
    return City.query()
      .where('tenant_id', tenantId)
      .whereIn('id', [...ids])
      .select(['id', 'name', 'state_code', 'timezone'])
  }

  async findBySlugForTenant(tenantId: number, slug: string): Promise<City | null> {
    return City.query().where('tenant_id', tenantId).where('slug', slug).preload('region').first()
  }

  async loadRegion(city: City): Promise<void> {
    await city.load('region')
  }

  async isSlugTaken(tenantId: number, slug: string, excludeId?: number): Promise<boolean> {
    const query = City.query().where('tenant_id', tenantId).where('slug', slug)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async isIbgeCodeTaken(tenantId: number, ibgeCode: string, excludeId?: number): Promise<boolean> {
    const query = City.query().where('tenant_id', tenantId).where('ibge_code', ibgeCode)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(data: {
    tenant_id: number
    region_id: number
    name: string
    slug: string
    state_code: string
    country_code: string
    ibge_code: string | null
    timezone: string
    latitude: number | null
    longitude: number | null
    sort_order: number
    is_active: boolean
  }): Promise<City> {
    return City.create(data)
  }
}

import Region from '#modules/geography/models/region'

export default class RegionRepository {
  async listByTenant(tenantId: number, includeInactive = false): Promise<Region[]> {
    const query = Region.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    if (!includeInactive) {
      query.where('is_active', true)
    }

    return query
  }

  async listPublic(tenantId: number): Promise<Region[]> {
    return Region.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .preload('cities', (query) => {
        query.where('is_active', true).orderBy('sort_order', 'asc').orderBy('name', 'asc')
      })
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<Region | null> {
    return Region.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findBySlugForTenant(tenantId: number, slug: string): Promise<Region | null> {
    return Region.query().where('tenant_id', tenantId).where('slug', slug).first()
  }

  async isSlugTaken(tenantId: number, slug: string, excludeId?: number): Promise<boolean> {
    const query = Region.query().where('tenant_id', tenantId).where('slug', slug)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(data: {
    tenant_id: number
    name: string
    slug: string
    description: string | null
    sort_order: number
    is_active: boolean
  }): Promise<Region> {
    return Region.create(data)
  }
}

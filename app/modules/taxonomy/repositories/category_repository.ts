import Category from '#modules/taxonomy/models/category'

export default class CategoryRepository {
  async listByTenant(
    tenantId: number,
    options: {
      includeInactive?: boolean
      familyId?: number
      parentId?: number | null
    } = {}
  ): Promise<Category[]> {
    const query = Category.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .preload('family')
      .preload('parent')

    if (!options.includeInactive) {
      query.where('is_active', true)
    }

    if (options.familyId !== undefined) {
      query.where('family_id', options.familyId)
    }

    if (options.parentId === null) {
      query.whereNull('parent_id')
    } else if (options.parentId !== undefined) {
      query.where('parent_id', options.parentId)
    }

    return query
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<Category | null> {
    return Category.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('family')
      .preload('parent')
      .preload('children', (query) => {
        query.orderBy('sort_order', 'asc').orderBy('name', 'asc')
      })
      .preload('attribute_definitions', (query) => {
        query
          .orderBy('sort_order', 'asc')
          .orderBy('name', 'asc')
          .preload('options', (optionQuery) => {
            optionQuery.orderBy('sort_order', 'asc').orderBy('label', 'asc')
          })
      })
      .first()
  }

  async isSlugTaken(tenantId: number, slug: string, excludeId?: number): Promise<boolean> {
    const query = Category.query().where('tenant_id', tenantId).where('slug', slug)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async hasChildren(tenantId: number, categoryId: number): Promise<boolean> {
    return Boolean(
      await Category.query().where('tenant_id', tenantId).where('parent_id', categoryId).first()
    )
  }

  async create(data: {
    tenant_id: number
    family_id: number
    parent_id: number | null
    name: string
    slug: string
    description: string | null
    icon: string | null
    sort_order: number
    is_active: boolean
    allows_always_open: boolean
  }): Promise<Category> {
    return Category.create(data)
  }
}

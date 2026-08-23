import CategoryFamily from '#modules/taxonomy/models/category_family'

export default class CategoryFamilyRepository {
  async listByTenant(tenantId: number, includeInactive = false): Promise<CategoryFamily[]> {
    const query = CategoryFamily.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    if (!includeInactive) {
      query.where('is_active', true)
    }

    return query
  }

  async listPublicTree(tenantId: number): Promise<CategoryFamily[]> {
    return CategoryFamily.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .preload('categories', (query) => {
        query
          .where('is_active', true)
          .whereNull('parent_id')
          .orderBy('sort_order', 'asc')
          .orderBy('name', 'asc')
          .preload('children', (childrenQuery) => {
            childrenQuery
              .where('is_active', true)
              .orderBy('sort_order', 'asc')
              .orderBy('name', 'asc')
              .preload('attribute_definitions', (attributeQuery) => {
                attributeQuery
                  .where('is_active', true)
                  .where('is_public', true)
                  .orderBy('sort_order', 'asc')
                  .orderBy('name', 'asc')
                  .preload('options', (optionQuery) => {
                    optionQuery
                      .where('is_active', true)
                      .orderBy('sort_order', 'asc')
                      .orderBy('label', 'asc')
                  })
              })
          })
          .preload('attribute_definitions', (attributeQuery) => {
            attributeQuery
              .where('is_active', true)
              .where('is_public', true)
              .orderBy('sort_order', 'asc')
              .orderBy('name', 'asc')
              .preload('options', (optionQuery) => {
                optionQuery
                  .where('is_active', true)
                  .orderBy('sort_order', 'asc')
                  .orderBy('label', 'asc')
              })
          })
      })
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<CategoryFamily | null> {
    return CategoryFamily.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async isSlugTaken(tenantId: number, slug: string, excludeId?: number): Promise<boolean> {
    const query = CategoryFamily.query().where('tenant_id', tenantId).where('slug', slug)

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
    icon: string | null
    sort_order: number
    is_active: boolean
  }): Promise<CategoryFamily> {
    return CategoryFamily.create(data)
  }
}

import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import type { CategoryAttributeType } from '#modules/taxonomy/interfaces/taxonomy_interface'

export default class CategoryAttributeDefinitionRepository {
  async listByTenant(
    tenantId: number,
    options: { categoryId?: number; includeInactive?: boolean } = {}
  ): Promise<CategoryAttributeDefinition[]> {
    const query = CategoryAttributeDefinition.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .preload('category')
      .preload('options', (optionQuery) => {
        optionQuery.orderBy('sort_order', 'asc').orderBy('label', 'asc')
      })

    if (options.categoryId !== undefined) {
      query.where('category_id', options.categoryId)
    }

    if (!options.includeInactive) {
      query.where('is_active', true)
    }

    return query
  }

  async findByIdForTenant(
    tenantId: number,
    id: number
  ): Promise<CategoryAttributeDefinition | null> {
    return CategoryAttributeDefinition.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('category')
      .preload('options', (query) => {
        query.orderBy('sort_order', 'asc').orderBy('label', 'asc')
      })
      .first()
  }

  async isKeyTaken(
    tenantId: number,
    categoryId: number,
    key: string,
    excludeId?: number
  ): Promise<boolean> {
    const query = CategoryAttributeDefinition.query()
      .where('tenant_id', tenantId)
      .where('category_id', categoryId)
      .where('key', key)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(data: {
    tenant_id: number
    category_id: number
    key: string
    name: string
    description: string | null
    data_type: CategoryAttributeType
    unit: string | null
    is_required: boolean
    is_filterable: boolean
    is_public: boolean
    applies_to_descendants: boolean
    sort_order: number
    is_active: boolean
    validation_rules: Record<string, unknown>
  }): Promise<CategoryAttributeDefinition> {
    return CategoryAttributeDefinition.create(data)
  }
}

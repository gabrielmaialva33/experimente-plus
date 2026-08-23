import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'

export default class CategoryAttributeOptionRepository {
  async listByDefinition(
    tenantId: number,
    definitionId: number,
    includeInactive = false
  ): Promise<CategoryAttributeOption[]> {
    const query = CategoryAttributeOption.query()
      .where('tenant_id', tenantId)
      .where('attribute_definition_id', definitionId)
      .orderBy('sort_order', 'asc')
      .orderBy('label', 'asc')

    if (!includeInactive) {
      query.where('is_active', true)
    }

    return query
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<CategoryAttributeOption | null> {
    return CategoryAttributeOption.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('attribute_definition')
      .first()
  }

  async isValueTaken(
    tenantId: number,
    definitionId: number,
    value: string,
    excludeId?: number
  ): Promise<boolean> {
    const query = CategoryAttributeOption.query()
      .where('tenant_id', tenantId)
      .where('attribute_definition_id', definitionId)
      .where('value', value)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(data: {
    tenant_id: number
    attribute_definition_id: number
    label: string
    value: string
    sort_order: number
    is_active: boolean
  }): Promise<CategoryAttributeOption> {
    return CategoryAttributeOption.create(data)
  }
}

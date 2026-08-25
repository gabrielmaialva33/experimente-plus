import type { CategoryAttributeType } from '#modules/taxonomy/interfaces/taxonomy_interface'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'

export default class CategoryAttributeDefinitionRepository {
  async listByTenant(
    tenantId: number,
    options: { categoryId?: number; includeInactive?: boolean } = {}
  ): Promise<CategoryAttributeDefinition[]> {
    const query = CategoryAttributeDefinition.query()
      .where('tenant_id', tenantId)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    if (options.categoryId !== undefined) {
      query.where('category_id', options.categoryId)
    }

    if (!options.includeInactive) {
      query.where('is_active', true)
    }

    const definitions = await query
    await this.loadRelations(tenantId, definitions)
    return definitions
  }

  async findRecordByIdForTenant(
    tenantId: number,
    id: number
  ): Promise<CategoryAttributeDefinition | null> {
    return CategoryAttributeDefinition.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findByIdForTenant(
    tenantId: number,
    id: number
  ): Promise<CategoryAttributeDefinition | null> {
    const definition = await this.findRecordByIdForTenant(tenantId, id)
    if (!definition) {
      return null
    }

    await this.loadRelations(tenantId, [definition])
    return definition
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

  private async loadRelations(
    tenantId: number,
    definitions: CategoryAttributeDefinition[]
  ): Promise<void> {
    if (definitions.length === 0) {
      return
    }

    const categoryIds = [...new Set(definitions.map((definition) => definition.category_id))]
    const categories = await Category.query()
      .where('tenant_id', tenantId)
      .whereIn('id', categoryIds)
    const categoriesById = new Map(categories.map((category) => [category.id, category]))

    const options = await CategoryAttributeOption.query()
      .where('tenant_id', tenantId)
      .whereIn(
        'attribute_definition_id',
        definitions.map((definition) => definition.id)
      )
      .orderBy('sort_order', 'asc')
      .orderBy('label', 'asc')
    const optionsByDefinition = new Map<number, CategoryAttributeOption[]>()

    for (const option of options) {
      const definitionOptions = optionsByDefinition.get(option.attribute_definition_id) ?? []
      definitionOptions.push(option)
      optionsByDefinition.set(option.attribute_definition_id, definitionOptions)
    }

    for (const definition of definitions) {
      definition.$setRelated('category', categoriesById.get(definition.category_id) ?? null)
      definition.$setRelated('options', optionsByDefinition.get(definition.id) ?? [])
    }
  }
}

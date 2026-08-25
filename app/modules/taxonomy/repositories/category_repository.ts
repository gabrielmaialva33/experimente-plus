import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryFamily from '#modules/taxonomy/models/category_family'

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

    const categories = await query
    await this.loadFamilyAndParent(tenantId, categories)
    return categories
  }

  async findRecordByIdForTenant(tenantId: number, id: number): Promise<Category | null> {
    return Category.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<Category | null> {
    const category = await this.findRecordByIdForTenant(tenantId, id)
    if (!category) {
      return null
    }

    await this.loadFamilyAndParent(tenantId, [category])

    const children = await Category.query()
      .where('tenant_id', tenantId)
      .where('parent_id', category.id)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
    category.$setRelated('children', children)

    const definitions = await CategoryAttributeDefinition.query()
      .where('tenant_id', tenantId)
      .where('category_id', category.id)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
    const definitionIds = definitions.map((definition) => definition.id)
    const options =
      definitionIds.length === 0
        ? []
        : await CategoryAttributeOption.query()
            .where('tenant_id', tenantId)
            .whereIn('attribute_definition_id', definitionIds)
            .orderBy('sort_order', 'asc')
            .orderBy('label', 'asc')
    const optionsByDefinition = new Map<number, CategoryAttributeOption[]>()

    for (const option of options) {
      const definitionOptions = optionsByDefinition.get(option.attribute_definition_id) ?? []
      definitionOptions.push(option)
      optionsByDefinition.set(option.attribute_definition_id, definitionOptions)
    }

    for (const definition of definitions) {
      definition.$setRelated('options', optionsByDefinition.get(definition.id) ?? [])
    }
    category.$setRelated('attribute_definitions', definitions)

    return category
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

  private async loadFamilyAndParent(tenantId: number, categories: Category[]): Promise<void> {
    if (categories.length === 0) {
      return
    }

    const familyIds = [...new Set(categories.map((category) => category.family_id))]
    const families = await CategoryFamily.query()
      .where('tenant_id', tenantId)
      .whereIn('id', familyIds)
    const familiesById = new Map(families.map((family) => [family.id, family]))

    const parentIds = [
      ...new Set(
        categories.flatMap((category) => (category.parent_id === null ? [] : [category.parent_id]))
      ),
    ]
    const parents =
      parentIds.length === 0
        ? []
        : await Category.query().where('tenant_id', tenantId).whereIn('id', parentIds)
    const parentsById = new Map(parents.map((parent) => [parent.id, parent]))

    for (const category of categories) {
      category.$setRelated('family', familiesById.get(category.family_id) ?? null)
      category.$setRelated(
        'parent',
        category.parent_id === null ? null : (parentsById.get(category.parent_id) ?? null)
      )
    }
  }
}

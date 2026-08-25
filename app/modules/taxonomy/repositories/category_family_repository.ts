import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
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
    const families = await CategoryFamily.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    if (families.length === 0) {
      return families
    }

    const rootCategories = await Category.query()
      .where('tenant_id', tenantId)
      .whereIn(
        'family_id',
        families.map((family) => family.id)
      )
      .where('is_active', true)
      .whereNull('parent_id')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    const rootIds = rootCategories.map((category) => category.id)
    const childCategories =
      rootIds.length === 0
        ? []
        : await Category.query()
            .where('tenant_id', tenantId)
            .whereIn('parent_id', rootIds)
            .where('is_active', true)
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc')

    const categories = [...rootCategories, ...childCategories]
    const categoryIds = categories.map((category) => category.id)
    const definitions =
      categoryIds.length === 0
        ? []
        : await CategoryAttributeDefinition.query()
            .where('tenant_id', tenantId)
            .whereIn('category_id', categoryIds)
            .where('is_active', true)
            .where('is_public', true)
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc')

    const definitionIds = definitions.map((definition) => definition.id)
    const options =
      definitionIds.length === 0
        ? []
        : await CategoryAttributeOption.query()
            .where('tenant_id', tenantId)
            .whereIn('attribute_definition_id', definitionIds)
            .where('is_active', true)
            .orderBy('sort_order', 'asc')
            .orderBy('label', 'asc')

    const optionsByDefinition = new Map<number, CategoryAttributeOption[]>()
    for (const option of options) {
      const definitionOptions = optionsByDefinition.get(option.attribute_definition_id) ?? []
      definitionOptions.push(option)
      optionsByDefinition.set(option.attribute_definition_id, definitionOptions)
    }

    const definitionsByCategory = new Map<number, CategoryAttributeDefinition[]>()
    for (const definition of definitions) {
      definition.$setRelated('options', optionsByDefinition.get(definition.id) ?? [])
      const categoryDefinitions = definitionsByCategory.get(definition.category_id) ?? []
      categoryDefinitions.push(definition)
      definitionsByCategory.set(definition.category_id, categoryDefinitions)
    }

    const childrenByParent = new Map<number, Category[]>()
    for (const child of childCategories) {
      child.$setRelated('attribute_definitions', definitionsByCategory.get(child.id) ?? [])
      const siblings = childrenByParent.get(child.parent_id!) ?? []
      siblings.push(child)
      childrenByParent.set(child.parent_id!, siblings)
    }

    const rootsByFamily = new Map<number, Category[]>()
    for (const root of rootCategories) {
      root.$setRelated('children', childrenByParent.get(root.id) ?? [])
      root.$setRelated('attribute_definitions', definitionsByCategory.get(root.id) ?? [])
      const familyCategories = rootsByFamily.get(root.family_id) ?? []
      familyCategories.push(root)
      rootsByFamily.set(root.family_id, familyCategories)
    }

    for (const family of families) {
      family.$setRelated('categories', rootsByFamily.get(family.id) ?? [])
    }

    return families
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

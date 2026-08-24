import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'

export type EffectiveAttributeDefinition = {
  definition: CategoryAttributeDefinition
  source_category_id: number
  inherited: boolean
}

export default class EffectiveCategoryAttributesService {
  async resolve(
    tenantId: number,
    categoryId: number,
    client?: TransactionClientContract
  ): Promise<EffectiveAttributeDefinition[]> {
    const lineage = await this.getLineage(tenantId, categoryId, client)
    const lineageIds = lineage.map((category) => category.id)
    const rank = new Map(lineageIds.map((id, index) => [id, index]))

    const definitions = await CategoryAttributeDefinition.query({ client })
      .where('tenant_id', tenantId)
      .whereIn('category_id', lineageIds)
      .where('is_active', true)
      .preload('options', (query) => {
        query.where('is_active', true).orderBy('sort_order', 'asc').orderBy('label', 'asc')
      })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')

    definitions.sort((left, right) => {
      const categoryOrder = (rank.get(left.category_id) ?? 0) - (rank.get(right.category_id) ?? 0)
      if (categoryOrder !== 0) return categoryOrder
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order
      return left.id - right.id
    })

    const effective = new Map<string, EffectiveAttributeDefinition>()
    for (const definition of definitions) {
      const inherited = definition.category_id !== categoryId
      if (inherited && !definition.applies_to_descendants) {
        continue
      }

      effective.set(definition.key, {
        definition,
        source_category_id: definition.category_id,
        inherited,
      })
    }

    return [...effective.values()].sort((left, right) => {
      if (left.definition.sort_order !== right.definition.sort_order) {
        return left.definition.sort_order - right.definition.sort_order
      }
      return left.definition.name.localeCompare(right.definition.name)
    })
  }

  async serialize(tenantId: number, categoryId: number): Promise<Record<string, unknown>[]> {
    const attributes = await this.resolve(tenantId, categoryId)
    return attributes.map(({ definition, source_category_id, inherited }) => ({
      ...definition.serialize(),
      source_category_id,
      inherited,
    }))
  }

  async assertSelectableCategory(
    tenantId: number,
    categoryId: number,
    client?: TransactionClientContract
  ): Promise<Category> {
    const category = await Category.query({ client })
      .where('tenant_id', tenantId)
      .where('id', categoryId)
      .where('is_active', true)
      .first()
    if (!category) {
      throw new NotFoundException('Category not found')
    }

    const activeChild = await Category.query({ client })
      .where('tenant_id', tenantId)
      .where('parent_id', category.id)
      .where('is_active', true)
      .first()
    if (activeChild) {
      throw new BadRequestException('Only leaf categories may classify an establishment')
    }

    return category
  }

  async allowsAlwaysOpen(
    tenantId: number,
    categoryId: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const lineage = await this.getLineage(tenantId, categoryId, client)
    return lineage.some((category) => category.allows_always_open)
  }

  async getLineage(
    tenantId: number,
    categoryId: number,
    client?: TransactionClientContract
  ): Promise<Category[]> {
    const lineage: Category[] = []
    const visited = new Set<number>()
    let currentId: number | null = categoryId

    while (currentId !== null) {
      if (visited.has(currentId)) {
        throw new BadRequestException('Category hierarchy contains a cycle')
      }
      visited.add(currentId)

      const category = await Category.query({ client })
        .where('tenant_id', tenantId)
        .where('id', currentId)
        .where('is_active', true)
        .first()
      if (!category) {
        throw new NotFoundException('Category not found')
      }

      lineage.unshift(category)
      currentId = category.parent_id
    }

    return lineage
  }
}

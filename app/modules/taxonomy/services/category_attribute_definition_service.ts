import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import ITaxonomy from '#modules/taxonomy/interfaces/taxonomy_interface'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeDefinitionRepository from '#modules/taxonomy/repositories/category_attribute_definition_repository'
import CategoryRepository from '#modules/taxonomy/repositories/category_repository'
import { normalizeSlug } from '#shared/utils/slug'

const FILTERABLE_TYPES = new Set(['boolean', 'integer', 'decimal', 'single_select', 'multi_select'])

@inject()
export default class CategoryAttributeDefinitionService {
  constructor(
    private definitionRepository: CategoryAttributeDefinitionRepository,
    private categoryRepository: CategoryRepository
  ) {}

  async list(
    tenantId: number,
    options: { categoryId?: number; includeInactive?: boolean } = {}
  ): Promise<CategoryAttributeDefinition[]> {
    return this.definitionRepository.listByTenant(tenantId, options)
  }

  async show(tenantId: number, id: number): Promise<CategoryAttributeDefinition> {
    return this.getOrFail(tenantId, id)
  }

  async create(
    tenantId: number,
    payload: ITaxonomy.AttributeDefinitionPayload
  ): Promise<CategoryAttributeDefinition> {
    await this.ensureCategory(tenantId, payload.category_id)
    const key = this.normalizeKey(payload.key)

    if (await this.definitionRepository.isKeyTaken(tenantId, payload.category_id, key)) {
      throw new BadRequestException('Attribute key is already in use for this category')
    }

    this.validateFilterability(payload.data_type, payload.is_filterable ?? false)

    return this.definitionRepository.create({
      tenant_id: tenantId,
      category_id: payload.category_id,
      key,
      name: payload.name.trim(),
      description: this.nullableText(payload.description),
      data_type: payload.data_type,
      unit: this.nullableText(payload.unit),
      is_required: payload.is_required ?? false,
      is_filterable: payload.is_filterable ?? false,
      is_public: payload.is_public ?? true,
      applies_to_descendants: payload.applies_to_descendants ?? true,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
      validation_rules: {},
    })
  }

  async update(
    tenantId: number,
    id: number,
    payload: ITaxonomy.AttributeDefinitionUpdatePayload
  ): Promise<CategoryAttributeDefinition> {
    const definition = await this.getOrFail(tenantId, id)
    const nextFilterable = payload.is_filterable ?? definition.is_filterable
    this.validateFilterability(definition.data_type, nextFilterable)

    if (payload.name !== undefined) {
      definition.name = payload.name.trim()
    }
    if (payload.description !== undefined) {
      definition.description = this.nullableText(payload.description)
    }
    if (payload.unit !== undefined) {
      definition.unit = this.nullableText(payload.unit)
    }
    if (payload.is_required !== undefined) {
      definition.is_required = payload.is_required
    }
    if (payload.is_filterable !== undefined) {
      definition.is_filterable = payload.is_filterable
    }
    if (payload.is_public !== undefined) {
      definition.is_public = payload.is_public
    }
    if (payload.applies_to_descendants !== undefined) {
      definition.applies_to_descendants = payload.applies_to_descendants
    }
    if (payload.sort_order !== undefined) {
      definition.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      definition.is_active = payload.is_active
    }

    await definition.save()
    return this.getOrFail(tenantId, id)
  }

  private async getOrFail(tenantId: number, id: number): Promise<CategoryAttributeDefinition> {
    const definition = await this.definitionRepository.findByIdForTenant(tenantId, id)
    if (!definition) {
      throw new NotFoundException('Category attribute definition not found')
    }
    return definition
  }

  private async ensureCategory(tenantId: number, categoryId: number): Promise<void> {
    const category = await this.categoryRepository.findByIdForTenant(tenantId, categoryId)
    if (!category) {
      throw new BadRequestException('Category is invalid for the active operation')
    }
  }

  private normalizeKey(value: string): string {
    const key = normalizeSlug(value).replace(/-/g, '_')
    if (!key) {
      throw new BadRequestException('Attribute key is invalid')
    }
    return key
  }

  private validateFilterability(dataType: string, isFilterable: boolean): void {
    if (isFilterable && !FILTERABLE_TYPES.has(dataType)) {
      throw new BadRequestException(`Attributes of type ${dataType} cannot be used as filters`)
    }
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }
}

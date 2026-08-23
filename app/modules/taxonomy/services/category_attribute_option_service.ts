import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import ITaxonomy from '#modules/taxonomy/interfaces/taxonomy_interface'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryAttributeDefinitionRepository from '#modules/taxonomy/repositories/category_attribute_definition_repository'
import CategoryAttributeOptionRepository from '#modules/taxonomy/repositories/category_attribute_option_repository'
import { normalizeSlug } from '#shared/utils/slug'

const SELECT_TYPES = new Set(['single_select', 'multi_select'])

@inject()
export default class CategoryAttributeOptionService {
  constructor(
    private optionRepository: CategoryAttributeOptionRepository,
    private definitionRepository: CategoryAttributeDefinitionRepository
  ) {}

  async list(
    tenantId: number,
    definitionId: number,
    includeInactive = false
  ): Promise<CategoryAttributeOption[]> {
    await this.ensureSelectDefinition(tenantId, definitionId)
    return this.optionRepository.listByDefinition(tenantId, definitionId, includeInactive)
  }

  async create(
    tenantId: number,
    payload: ITaxonomy.AttributeOptionPayload
  ): Promise<CategoryAttributeOption> {
    await this.ensureSelectDefinition(tenantId, payload.attribute_definition_id)
    const value = this.normalizeValue(payload.value ?? payload.label)

    if (
      await this.optionRepository.isValueTaken(tenantId, payload.attribute_definition_id, value)
    ) {
      throw new BadRequestException('Attribute option value is already in use')
    }

    return this.optionRepository.create({
      tenant_id: tenantId,
      attribute_definition_id: payload.attribute_definition_id,
      label: payload.label.trim(),
      value,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
  }

  async update(
    tenantId: number,
    id: number,
    payload: ITaxonomy.AttributeOptionUpdatePayload
  ): Promise<CategoryAttributeOption> {
    const option = await this.getOrFail(tenantId, id)
    await this.ensureSelectDefinition(tenantId, option.attribute_definition_id)

    if (payload.value !== undefined) {
      const value = this.normalizeValue(payload.value)
      if (
        await this.optionRepository.isValueTaken(
          tenantId,
          option.attribute_definition_id,
          value,
          id
        )
      ) {
        throw new BadRequestException('Attribute option value is already in use')
      }
      option.value = value
    }
    if (payload.label !== undefined) {
      option.label = payload.label.trim()
    }
    if (payload.sort_order !== undefined) {
      option.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      option.is_active = payload.is_active
    }

    await option.save()
    return option
  }

  private async getOrFail(tenantId: number, id: number): Promise<CategoryAttributeOption> {
    const option = await this.optionRepository.findByIdForTenant(tenantId, id)
    if (!option) {
      throw new NotFoundException('Category attribute option not found')
    }
    return option
  }

  private async ensureSelectDefinition(tenantId: number, definitionId: number): Promise<void> {
    const definition = await this.definitionRepository.findByIdForTenant(tenantId, definitionId)
    if (!definition) {
      throw new BadRequestException('Attribute definition is invalid for the active operation')
    }
    if (!SELECT_TYPES.has(definition.data_type)) {
      throw new BadRequestException('Options are only allowed for select attributes')
    }
  }

  private normalizeValue(value: string): string {
    const normalized = normalizeSlug(value)
    if (!normalized) {
      throw new BadRequestException('Attribute option value is invalid')
    }
    return normalized
  }
}

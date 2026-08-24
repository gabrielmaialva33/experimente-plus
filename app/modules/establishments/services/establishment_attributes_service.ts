import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import type CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentAttributesService {
  constructor(
    private accessService: EstablishmentAccessService,
    private effectiveAttributesService: EffectiveCategoryAttributesService,
    private auditService: EstablishmentAuditService
  ) {}

  async effective(tenantId: number, categoryId: number) {
    await this.effectiveAttributesService.assertSelectableCategory(tenantId, categoryId)
    return this.effectiveAttributesService.serialize(tenantId, categoryId)
  }

  async replace(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.AttributeValuePayload[]
  ) {
    const definitionIds = payload.map((item) => item.attribute_definition_id)
    if (new Set(definitionIds).size !== definitionIds.length) {
      throw new BadRequestException('Attribute definitions must be unique')
    }

    const values = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )
      const primaryCategory = await EstablishmentRevisionCategory.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .where('is_primary', true)
        .first()

      if (!primaryCategory && payload.length > 0) {
        throw new BadRequestException('A primary category is required before setting attributes')
      }

      const effective = primaryCategory
        ? await this.effectiveAttributesService.resolve(
            tenantId,
            primaryCategory.category_id,
            client
          )
        : []
      const effectiveById = new Map(
        effective.map(({ definition }) => [definition.id, definition] as const)
      )

      await EstablishmentRevisionAttributeValue.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .delete()

      for (const item of payload) {
        const definition = effectiveById.get(item.attribute_definition_id)
        if (!definition) {
          throw new BadRequestException(
            'Attribute definition does not apply to the primary category'
          )
        }

        const normalized = this.normalizeValue(definition, item)
        if (!normalized) continue

        const value = await EstablishmentRevisionAttributeValue.create(
          {
            tenant_id: tenantId,
            revision_id: revision.id,
            attribute_definition_id: definition.id,
            value_text: normalized.value_text,
            value_boolean: normalized.value_boolean,
            value_integer: normalized.value_integer,
            value_decimal: normalized.value_decimal,
            value_url: normalized.value_url,
          },
          { client }
        )

        if (normalized.option_ids.length > 0) {
          await EstablishmentRevisionAttributeValueOption.createMany(
            normalized.option_ids.map((optionId) => ({
              tenant_id: tenantId,
              attribute_value_id: value.id,
              attribute_definition_id: definition.id,
              attribute_option_id: optionId,
            })),
            { client }
          )
        }
      }

      return EstablishmentRevisionAttributeValue.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .preload('definition')
        .preload('selected_options', (query) => query.preload('option'))
        .orderBy('attribute_definition_id', 'asc')
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { section: 'attributes', count: values.length },
    })

    return values
  }

  private normalizeValue(
    definition: CategoryAttributeDefinition,
    item: IEstablishment.AttributeValuePayload
  ): {
    value_text: string | null
    value_boolean: boolean | null
    value_integer: number | null
    value_decimal: number | null
    value_url: string | null
    option_ids: number[]
  } | null {
    const empty = {
      value_text: null,
      value_boolean: null,
      value_integer: null,
      value_decimal: null,
      value_url: null,
      option_ids: [] as number[],
    }

    if (definition.data_type === 'text' || definition.data_type === 'long_text') {
      if (item.value === undefined || item.value === null || item.value === '') return null
      if (typeof item.value !== 'string') {
        throw new BadRequestException(`${definition.key} must be a string`)
      }
      return { ...empty, value_text: item.value.trim() }
    }

    if (definition.data_type === 'boolean') {
      if (item.value === undefined || item.value === null) return null
      if (typeof item.value !== 'boolean') {
        throw new BadRequestException(`${definition.key} must be boolean`)
      }
      return { ...empty, value_boolean: item.value }
    }

    if (definition.data_type === 'integer') {
      if (item.value === undefined || item.value === null) return null
      if (typeof item.value !== 'number' || !Number.isInteger(item.value)) {
        throw new BadRequestException(`${definition.key} must be an integer`)
      }
      return { ...empty, value_integer: item.value }
    }

    if (definition.data_type === 'decimal') {
      if (item.value === undefined || item.value === null) return null
      if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
        throw new BadRequestException(`${definition.key} must be a finite number`)
      }
      return { ...empty, value_decimal: item.value }
    }

    if (definition.data_type === 'url') {
      if (item.value === undefined || item.value === null || item.value === '') return null
      if (typeof item.value !== 'string') {
        throw new BadRequestException(`${definition.key} must be a URL`)
      }
      let url: URL
      try {
        url = new URL(item.value.trim())
      } catch {
        throw new BadRequestException(`${definition.key} must be a valid URL`)
      }
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new BadRequestException(`${definition.key} must use HTTP or HTTPS`)
      }
      return { ...empty, value_url: url.toString() }
    }

    const optionIds = [...new Set(item.option_ids ?? [])]
    if (optionIds.length === 0) return null
    if (definition.data_type === 'single_select' && optionIds.length !== 1) {
      throw new BadRequestException(`${definition.key} accepts exactly one option`)
    }

    const allowedOptionIds = new Set(definition.options.map((option) => option.id))
    if (optionIds.some((optionId) => !allowedOptionIds.has(optionId))) {
      throw new BadRequestException(`${definition.key} contains an invalid or inactive option`)
    }

    return { ...empty, option_ids: optionIds }
  }
}

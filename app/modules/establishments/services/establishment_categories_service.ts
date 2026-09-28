import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionAttributeValueRepository from '#modules/establishments/repositories/establishment_revision_attribute_value_repository'
import EstablishmentRevisionCategoryRepository from '#modules/establishments/repositories/establishment_revision_category_repository'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentCategoriesService {
  constructor(
    private accessService: EstablishmentAccessService,
    private effectiveAttributesService: EffectiveCategoryAttributesService,
    private auditService: EstablishmentAuditService,
    private categoryRepository: EstablishmentRevisionCategoryRepository,
    private attributeValueRepository: EstablishmentRevisionAttributeValueRepository
  ) {}

  async replace(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.CategoryPayload[]
  ) {
    this.validatePayload(payload)

    const result = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )

      for (const item of payload) {
        await this.effectiveAttributesService.assertSelectableCategory(
          tenantId,
          item.category_id,
          client
        )
      }

      await this.categoryRepository.deleteForRevision(tenantId, revision.id, client)

      if (payload.length > 0) {
        await this.categoryRepository.createManyForRevision(
          payload.map((item, index) => ({
            tenant_id: tenantId,
            revision_id: revision.id,
            category_id: item.category_id,
            is_primary: item.is_primary ?? false,
            sort_order: item.sort_order ?? index,
          })),
          client
        )
      }

      const primaryCategoryId = payload.find((item) => item.is_primary)?.category_id ?? null
      const effectiveDefinitions = primaryCategoryId
        ? await this.effectiveAttributesService.resolve(tenantId, primaryCategoryId, client)
        : []
      const effectiveDefinitionIds = effectiveDefinitions.map(({ definition }) => definition.id)
      await this.attributeValueRepository.deleteOutsideDefinitions(
        tenantId,
        revision.id,
        effectiveDefinitionIds,
        client
      )

      return this.categoryRepository.listForRevision(tenantId, revision.id, client)
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { section: 'categories', count: result.length },
    })

    return result
  }

  private validatePayload(payload: IEstablishment.CategoryPayload[]): void {
    if (payload.length > 10) {
      throw new BadRequestException('An establishment revision may have at most ten categories')
    }

    const categoryIds = payload.map((item) => item.category_id)
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new BadRequestException('Category selections must be unique')
    }

    const primaryCount = payload.filter((item) => item.is_primary).length
    if (payload.length > 0 && primaryCount !== 1) {
      throw new BadRequestException('Exactly one selected category must be primary')
    }
  }
}

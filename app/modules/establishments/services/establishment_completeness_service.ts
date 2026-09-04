import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import { evaluateEstablishmentCompleteness } from '#modules/establishments/services/establishment_completeness_evaluator'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import City from '#modules/geography/models/city'
import Organization from '#modules/organizations/models/organization'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentCompletenessService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private effectiveAttributesService: EffectiveCategoryAttributesService
  ) {}

  async check(
    tenantId: number,
    establishmentId: number,
    actor: User,
    revisionIdOverride?: number,
    client?: TransactionClientContract
  ): Promise<IEstablishment.CompletenessResult> {
    const establishment = await this.accessService.getReadable(tenantId, establishmentId, actor)
    const openRevision = revisionIdOverride
      ? null
      : await this.revisionRepository.findOpenForEstablishment(tenantId, establishment.id)
    const revisionId = revisionIdOverride ?? openRevision?.id ?? establishment.published_revision_id
    if (!revisionId) {
      throw new NotFoundException('Establishment revision not found')
    }

    const revision = await this.revisionRepository.findAggregate(tenantId, revisionId, client)
    if (!revision || revision.establishment_id !== establishment.id) {
      throw new NotFoundException('Establishment revision not found')
    }

    const organizationQuery = client ? Organization.query({ client }) : Organization.query()
    organizationQuery.where('tenant_id', tenantId).where('id', establishment.organization_id)
    if (client) {
      organizationQuery.forUpdate()
    }
    const organization = await organizationQuery.first()
    const city = revision.city_id
      ? await City.query()
          .where('tenant_id', tenantId)
          .where('id', revision.city_id)
          .where('is_active', true)
          .first()
      : null

    const primaryCategory = revision.categories.find((category) => category.is_primary)
    const primaryCategoryIsActive = Boolean(primaryCategory?.category?.is_active)
    const effectiveAttributes =
      primaryCategory && primaryCategoryIsActive
        ? await this.effectiveAttributesService.resolve(
            tenantId,
            primaryCategory.category_id,
            client
          )
        : []
    const allowsAlwaysOpen =
      revision.availability_type === 'always_open' && primaryCategory && primaryCategoryIsActive
        ? await this.effectiveAttributesService.allowsAlwaysOpen(
            tenantId,
            primaryCategory.category_id,
            client
          )
        : false

    return evaluateEstablishmentCompleteness({
      revision,
      organization_active: organization?.status === 'active',
      city_active: city !== null,
      effective_attributes: effectiveAttributes,
      allows_always_open: allowsAlwaysOpen,
      checked_at: DateTime.utc().toISO()!,
    })
  }

  /**
   * Evaluates a Portal overview batch from tenant-scoped establishments whose
   * organizations were already returned by the canonical authorization-aware
   * OrganizationService. Every relation needed by the evaluator is preloaded
   * by EstablishmentRepository.listForAuthorizedOrganizations.
   */
  async checkManyForAuthorizedOrganizations(
    tenantId: number,
    organizations: readonly Organization[],
    establishments: readonly Establishment[]
  ): Promise<Map<number, IEstablishment.CompletenessResult>> {
    const organizationById = new Map<number, Organization>()
    for (const organization of organizations) {
      if (organization.tenant_id !== tenantId) {
        throw new NotFoundException('Organization not found')
      }
      organizationById.set(organization.id, organization)
    }

    const revisionByEstablishment = new Map<number, EstablishmentRevision>()
    const cityIds = new Set<number>()
    const categoryIds = new Set<number>()

    for (const establishment of establishments) {
      if (
        establishment.tenant_id !== tenantId ||
        !organizationById.has(establishment.organization_id)
      ) {
        throw new NotFoundException('Establishment not found')
      }

      const revision = this.loadedCompletenessRevision(establishment)
      if (
        !revision ||
        revision.tenant_id !== tenantId ||
        revision.establishment_id !== establishment.id
      ) {
        throw new NotFoundException('Establishment revision not found')
      }
      revisionByEstablishment.set(establishment.id, revision)

      if (revision.city_id !== null) {
        cityIds.add(revision.city_id)
      }
      const primaryCategory = revision.categories.find((category) => category.is_primary)
      if (primaryCategory?.category?.tenant_id === tenantId && primaryCategory.category.is_active) {
        categoryIds.add(primaryCategory.category_id)
      }
    }

    const activeCityIds = new Set<number>()
    if (cityIds.size > 0) {
      const cities = await City.query()
        .where('tenant_id', tenantId)
        .whereIn('id', [...cityIds])
        .where('is_active', true)
      for (const city of cities) {
        activeCityIds.add(city.id)
      }
    }

    const categoryContexts = await this.effectiveAttributesService.resolveMany(tenantId, [
      ...categoryIds,
    ])
    const checkedAt = DateTime.utc().toISO()!
    const results = new Map<number, IEstablishment.CompletenessResult>()

    for (const establishment of establishments) {
      const revision = revisionByEstablishment.get(establishment.id)
      const organization = organizationById.get(establishment.organization_id)
      if (!revision || !organization) {
        throw new NotFoundException('Establishment not found')
      }

      const primaryCategory = revision.categories.find((category) => category.is_primary)
      const categoryContext = primaryCategory
        ? categoryContexts.get(primaryCategory.category_id)
        : undefined

      results.set(
        establishment.id,
        evaluateEstablishmentCompleteness({
          revision,
          organization_active: organization.status === 'active',
          city_active: revision.city_id !== null && activeCityIds.has(revision.city_id),
          effective_attributes: categoryContext?.attributes ?? [],
          allows_always_open: categoryContext?.allows_always_open ?? false,
          checked_at: checkedAt,
        })
      )
    }

    return results
  }

  private loadedCompletenessRevision(establishment: Establishment): EstablishmentRevision | null {
    const openRevision = establishment.revisions
      .filter((revision) =>
        ['draft', 'pending_review', 'changes_requested'].includes(revision.status)
      )
      .sort((left, right) => right.version - left.version || right.id - left.id)[0]

    if (openRevision) {
      return openRevision
    }

    if (
      establishment.published_revision_id !== null &&
      establishment.published_revision?.id === establishment.published_revision_id
    ) {
      return establishment.published_revision
    }

    return null
  }
}

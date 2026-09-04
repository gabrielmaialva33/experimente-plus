import { inject } from '@adonisjs/core'

import NotFoundException from '#exceptions/not_found_exception'
import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import EstablishmentService from '#modules/establishments/services/establishment_service'
import City from '#modules/geography/models/city'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationService from '#modules/organizations/services/organization_service'
import OrganizationResourceAuthorizationService, {
  type OrganizationActorAuthorizationContext,
} from '#modules/organizations/services/organization_resource_authorization_service'
import type IPortal from '#modules/portal/interfaces/portal_interface'
import { feedbackTargetsFromOverview } from '#modules/portal/services/portal_overview_projection'
import Category from '#modules/taxonomy/models/category'
import type User from '#modules/users/models/user'

@inject()
export default class PartnerPortalService {
  constructor(
    private organizationService: OrganizationService,
    private establishmentService: EstablishmentService,
    private establishmentRepository: EstablishmentRepository,
    private completenessService: EstablishmentCompletenessService,
    private effectiveAttributesService: EffectiveCategoryAttributesService,
    private resourceAuthorization: OrganizationResourceAuthorizationService
  ) {}

  async overview(
    tenantId: number,
    _actor: User,
    authorizationContext: OrganizationActorAuthorizationContext
  ): Promise<IPortal.Overview> {
    const organizations = await this.organizationService.listFromAccessSnapshot(
      tenantId,
      authorizationContext.access_snapshot
    )
    const roleByOrganization = new Map(
      authorizationContext.access_snapshot.organization_accesses.map((access) => [
        access.organization_id,
        access.capabilities.role,
      ])
    )
    const establishmentsByOrganization = await this.establishmentSummariesForOrganizations(
      tenantId,
      organizations
    )

    const organizationSummaries = organizations.map((organization) => {
      const serialized = organization.serialize() as Record<string, unknown>
      const organizationId = Number(serialized.id)
      return this.organizationSummary(
        serialized,
        roleByOrganization.get(organizationId) ?? null,
        establishmentsByOrganization.get(organizationId) ?? [],
        this.resourceAuthorization.forOrganizationFromContext(organizationId, authorizationContext)
      )
    })

    return {
      organizations: organizationSummaries,
      totals: organizationSummaries.reduce(
        (totals, organization) => ({
          organizations: totals.organizations + 1,
          establishments: totals.establishments + organization.totals.establishments,
          published: totals.published + organization.totals.published,
          pending_review: totals.pending_review + organization.totals.pending_review,
          complete: totals.complete + organization.totals.complete,
        }),
        {
          organizations: 0,
          establishments: 0,
          published: 0,
          pending_review: 0,
          complete: 0,
        }
      ),
    }
  }

  async organization(tenantId: number, organizationId: number, actor: User) {
    const organization = await this.organizationService.show(tenantId, organizationId, actor)
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenantId, actor)
    const organizationAccess = authorizationContext.access_snapshot.organization_accesses.find(
      (access) => access.organization_id === organizationId
    )
    const establishmentsByOrganization = await this.establishmentSummariesForOrganizations(
      tenantId,
      [organization]
    )

    return this.organizationSummary(
      organization.serialize() as Record<string, unknown>,
      organizationAccess?.capabilities.role ?? null,
      establishmentsByOrganization.get(organizationId) ?? [],
      this.resourceAuthorization.forOrganizationFromContext(organizationId, authorizationContext)
    )
  }

  async establishmentEditor(tenantId: number, establishmentId: number, actor: User) {
    const establishment = await this.establishmentService.show(tenantId, establishmentId, actor)
    const completeness = await this.completenessService.check(tenantId, establishmentId, actor)
    const cities = await City.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
    const categories = await Category.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
    const establishmentRecord = establishment as Record<string, unknown>
    const revision = this.recordValue(establishmentRecord.revision)
    const effectiveAttributes = await this.effectiveAttributes(tenantId, establishmentRecord)
    const revisionId = this.numberValue(revision, 'id')
    const revisionStatus = this.stringValue(revision, 'status')
    const reviewIssues =
      revisionId && revisionStatus === 'changes_requested'
        ? await EstablishmentRevisionReviewIssue.query()
            .where('tenant_id', tenantId)
            .where('establishment_id', establishmentId)
            .where('revision_id', revisionId)
            .whereNull('resolved_at')
            .orderBy('severity', 'asc')
            .orderBy('id', 'asc')
        : []

    return {
      establishment,
      completeness,
      cities: cities.map((city) => city.serialize()),
      categories: categories.map((category) => category.serialize()),
      effective_attributes: effectiveAttributes,
      review_issues: reviewIssues.map((issue) => issue.serialize()),
    }
  }

  async creationOptions(tenantId: number) {
    const cities = await City.query()
      .where('tenant_id', tenantId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')

    return {
      cities: cities.map((city) => city.serialize()),
    }
  }

  async feedbackTargets(tenantId: number, actor: User) {
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenantId, actor)
    const overview = await this.overview(tenantId, actor, authorizationContext)
    return this.feedbackTargetsFromOverview(overview)
  }

  feedbackTargetsFromOverview(overview: IPortal.Overview): IPortal.FeedbackTargets {
    return feedbackTargetsFromOverview(overview)
  }

  private async establishmentSummariesForOrganizations(
    tenantId: number,
    organizations: readonly Organization[]
  ): Promise<Map<number, IPortal.EstablishmentSummary[]>> {
    const establishments = await this.establishmentRepository.listForAuthorizedOrganizations(
      tenantId,
      organizations.map((organization) => organization.id)
    )
    const completenessByEstablishment =
      await this.completenessService.checkManyForAuthorizedOrganizations(
        tenantId,
        organizations,
        establishments
      )
    const summariesByOrganization = new Map<number, IPortal.EstablishmentSummary[]>()

    for (const establishment of establishments) {
      const completeness = completenessByEstablishment.get(establishment.id)
      if (!completeness) {
        throw new NotFoundException('Establishment completeness not found')
      }

      const revision = establishment.revisions[0] ?? establishment.published_revision ?? null
      const summaries = summariesByOrganization.get(establishment.organization_id) ?? []
      summaries.push({
        id: establishment.id,
        organization_id: establishment.organization_id,
        public_name: revision?.public_name?.trim() || `Unidade ${establishment.id}`,
        lifecycle_status: establishment.lifecycle_status,
        business_status: establishment.business_status,
        published_revision_id: establishment.published_revision_id,
        revision: this.revisionSummary(revision),
        published_revision: this.revisionSummary(establishment.published_revision),
        completeness,
      })
      summariesByOrganization.set(establishment.organization_id, summaries)
    }

    return summariesByOrganization
  }

  private revisionSummary(revision: EstablishmentRevision | null): Record<string, unknown> | null {
    if (!revision) {
      return null
    }

    return {
      id: revision.id,
      status: revision.status,
      public_name: revision.public_name,
      slug: revision.slug,
      city_id: revision.city_id,
    }
  }

  private organizationSummary(
    organization: Record<string, unknown>,
    role: string | null,
    establishments: IPortal.EstablishmentSummary[],
    allowedActions: IOrganization.AllowedActions
  ): IPortal.OrganizationSummary {
    const id = Number(organization.id)
    const status = String(organization.status)
    const published = establishments.filter(
      (establishment) => establishment.published_revision_id !== null
    ).length
    const pendingReview = establishments.filter(
      (establishment) => this.stringValue(establishment.revision, 'status') === 'pending_review'
    ).length
    const complete = establishments.filter(
      (establishment) => establishment.completeness.eligible
    ).length
    const hasUnit = establishments.length > 0
    const hasCompleteUnit = complete > 0
    const hasPublishedUnit = published > 0

    return {
      id,
      legal_name: String(organization.legal_name),
      trade_name: String(organization.trade_name),
      slug: String(organization.slug),
      tax_id: String(organization.tax_id),
      email: String(organization.email),
      phone: String(organization.phone),
      website:
        organization.website === null || organization.website === undefined
          ? null
          : String(organization.website),
      status,
      role,
      allowed_actions: allowedActions,
      establishments,
      totals: {
        establishments: establishments.length,
        published,
        pending_review: pendingReview,
        complete,
      },
      onboarding: [
        {
          key: 'organization_created',
          label: 'Organização criada',
          completed: true,
          href: `/portal/organizations/${id}`,
          available: allowedActions.organizations.read,
        },
        {
          key: 'organization_active',
          label: 'Organização aprovada e ativa',
          completed: status === 'active',
          href: `/portal/organizations/${id}`,
          available: allowedActions.organizations.read,
        },
        {
          key: 'establishment_created',
          label: 'Primeira unidade criada',
          completed: hasUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
          available: hasUnit
            ? allowedActions.establishments.read
            : allowedActions.establishments.create,
        },
        {
          key: 'establishment_complete',
          label: 'Ficha pronta para submissão',
          completed: hasCompleteUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
          available: hasUnit
            ? allowedActions.establishments.read
            : allowedActions.establishments.create,
        },
        {
          key: 'establishment_published',
          label: 'Unidade publicada no catálogo',
          completed: hasPublishedUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
          available: hasUnit
            ? allowedActions.establishments.read
            : allowedActions.establishments.create,
        },
        {
          key: 'analytics_available',
          label: 'Métricas de descoberta disponíveis',
          completed: hasPublishedUnit,
          href: `/organizations/${id}/analytics`,
          available: allowedActions.analytics.read,
        },
      ],
    }
  }

  private async effectiveAttributes(
    tenantId: number,
    establishment: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    const revision = this.recordValue(establishment.revision)
    const primaryCategory = this.recordArray(revision?.categories).find(
      (category) => category.is_primary === true
    )
    const categoryId = this.numberValue(primaryCategory ?? null, 'category_id')
    if (categoryId === null) {
      return []
    }

    const existingValues = new Map<number, Record<string, unknown>>()
    for (const value of this.recordArray(revision?.attribute_values)) {
      const definitionId = this.numberValue(value, 'attribute_definition_id')
      if (definitionId !== null) {
        existingValues.set(definitionId, value)
      }
    }

    const effective = await this.effectiveAttributesService.resolve(tenantId, categoryId)
    return effective.map(({ definition, source_category_id, inherited }) => {
      const currentValue = existingValues.get(definition.id) ?? null

      return {
        ...definition.serialize(),
        options: definition.options.map((option) => option.serialize()),
        source_category_id,
        inherited,
        value: this.attributeValue(definition.data_type, currentValue),
        option_ids: this.recordArray(currentValue?.selected_options).flatMap((selectedOption) => {
          const optionId =
            this.numberValue(selectedOption, 'attribute_option_id') ??
            this.numberValue(this.recordValue(selectedOption.option), 'id')
          return optionId === null ? [] : [optionId]
        }),
      }
    })
  }

  private attributeValue(
    dataType: string,
    value: Record<string, unknown> | null
  ): string | number | boolean | null {
    if (dataType === 'text' || dataType === 'long_text') {
      return this.stringValue(value, 'value_text')
    }
    if (dataType === 'boolean') {
      return typeof value?.value_boolean === 'boolean' ? value.value_boolean : null
    }
    if (dataType === 'integer') {
      return this.numberValue(value, 'value_integer')
    }
    if (dataType === 'decimal') {
      return this.numberValue(value, 'value_decimal')
    }
    if (dataType === 'url') {
      return this.stringValue(value, 'value_url')
    }
    return null
  }

  private recordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => this.recordValue(item) !== null)
      : []
  }

  private recordValue(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private numberValue(record: Record<string, unknown> | null, key: string): number | null {
    const value = record?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
    return null
  }

  private stringValue(record: Record<string, unknown> | null, key: string): string | null {
    const value = record?.[key]
    return typeof value === 'string' ? value : null
  }
}

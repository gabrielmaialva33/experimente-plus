import { inject } from '@adonisjs/core'

import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import EstablishmentService from '#modules/establishments/services/establishment_service'
import City from '#modules/geography/models/city'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationService from '#modules/organizations/services/organization_service'
import type IPortal from '#modules/portal/interfaces/portal_interface'
import Category from '#modules/taxonomy/models/category'
import type User from '#modules/users/models/user'

@inject()
export default class PartnerPortalService {
  constructor(
    private organizationService: OrganizationService,
    private establishmentService: EstablishmentService,
    private completenessService: EstablishmentCompletenessService,
    private effectiveAttributesService: EffectiveCategoryAttributesService
  ) {}

  async overview(tenantId: number, actor: User): Promise<IPortal.Overview> {
    const organizations = await this.organizationService.list(tenantId, actor)
    const memberships = await OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('user_id', actor.id)
      .where('status', 'active')
    const roleByOrganization = new Map(
      memberships.map((membership) => [membership.organization_id, membership.role])
    )

    const organizationSummaries: IPortal.OrganizationSummary[] = []
    for (const organization of organizations) {
      const serialized = organization.serialize() as Record<string, unknown>
      const organizationId = Number(serialized.id)
      const establishments = await this.establishmentSummaries(tenantId, organizationId, actor)

      organizationSummaries.push(
        this.organizationSummary(
          serialized,
          roleByOrganization.get(organizationId) ?? null,
          establishments
        )
      )
    }

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
    const membership = await OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('user_id', actor.id)
      .where('status', 'active')
      .first()
    const establishments = await this.establishmentSummaries(tenantId, organizationId, actor)

    return this.organizationSummary(
      organization.serialize() as Record<string, unknown>,
      membership?.role ?? null,
      establishments
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
    const overview = await this.overview(tenantId, actor)

    return {
      organizations: overview.organizations.map((organization) => ({
        id: organization.id,
        label: organization.trade_name,
      })),
      establishments: overview.organizations.flatMap((organization) =>
        organization.establishments.map((establishment) => ({
          id: establishment.id,
          organization_id: organization.id,
          label:
            this.stringValue(establishment.revision, 'public_name') ??
            `Unidade ${establishment.id}`,
        }))
      ),
    }
  }

  private async establishmentSummaries(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<IPortal.EstablishmentSummary[]> {
    const establishments = await this.establishmentService.list(tenantId, organizationId, actor)

    const summaries: IPortal.EstablishmentSummary[] = []
    for (const establishment of establishments) {
      const record = establishment as Record<string, unknown>
      const id = Number(record.id)
      const completeness = await this.completenessService.check(tenantId, id, actor)

      summaries.push({
        id,
        organization_id: Number(record.organization_id),
        lifecycle_status: String(record.lifecycle_status),
        business_status: String(record.business_status),
        published_revision_id:
          record.published_revision_id === null || record.published_revision_id === undefined
            ? null
            : Number(record.published_revision_id),
        revision: this.recordValue(record.revision),
        published_revision: this.recordValue(record.published_revision),
        completeness,
      })
    }

    return summaries
  }

  private organizationSummary(
    organization: Record<string, unknown>,
    role: string | null,
    establishments: IPortal.EstablishmentSummary[]
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
        },
        {
          key: 'organization_active',
          label: 'Organização aprovada e ativa',
          completed: status === 'active',
          href: `/portal/organizations/${id}`,
        },
        {
          key: 'establishment_created',
          label: 'Primeira unidade criada',
          completed: hasUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
        },
        {
          key: 'establishment_complete',
          label: 'Ficha pronta para submissão',
          completed: hasCompleteUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
        },
        {
          key: 'establishment_published',
          label: 'Unidade publicada no catálogo',
          completed: hasPublishedUnit,
          href: hasUnit
            ? `/portal/establishments/${establishments[0].id}`
            : `/portal/organizations/${id}/establishments/new`,
        },
        {
          key: 'analytics_available',
          label: 'Métricas de descoberta disponíveis',
          completed: hasPublishedUnit,
          href: `/organizations/${id}/analytics`,
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

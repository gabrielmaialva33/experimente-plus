import { inject } from '@adonisjs/core'

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
    private completenessService: EstablishmentCompletenessService
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

    const organizationSummaries = await Promise.all(
      organizations.map(async (organization) => {
        const serialized = organization.serialize() as Record<string, unknown>
        const organizationId = Number(serialized.id)
        const establishments = await this.establishmentSummaries(tenantId, organizationId, actor)

        return this.organizationSummary(
          serialized,
          roleByOrganization.get(organizationId) ?? null,
          establishments
        )
      })
    )

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

    return {
      establishment,
      completeness,
      cities: cities.map((city) => city.serialize()),
      categories: categories.map((category) => category.serialize()),
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

    return Promise.all(
      establishments.map(async (establishment) => {
        const record = establishment as Record<string, unknown>
        const id = Number(record.id)
        return {
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
          completeness: await this.completenessService.check(tenantId, id, actor),
        }
      })
    )
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

  private recordValue(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private stringValue(record: Record<string, unknown> | null, key: string): string | null {
    const value = record?.[key]
    return typeof value === 'string' ? value : null
  }
}

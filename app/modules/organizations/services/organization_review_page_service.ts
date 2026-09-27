import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import { ORGANIZATION_STATUSES } from '#modules/organizations/interfaces/organization_interface'
import type {
  OrganizationClaimQueueRow,
  OrganizationReviewHistoryEntry,
  OrganizationReviewPageProps,
  OrganizationReviewPerson,
  OrganizationReviewQueuePageProps,
} from '#modules/organizations/interfaces/organization_review_pages'
import type Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationClaimService from '#modules/organizations/services/organization_claim_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionService from '#modules/permissions/services/permission_service'
import User from '#modules/users/models/user'

/** The reason `OrganizationAuditService` writes on every completed domain operation. */
const DOMAIN_AUDIT_REASON = 'Domain operation completed'

const permissionName = (resource: IPermission.Resources, action: IPermission.Actions) =>
  `${resource}.${action}`

function iso(value: DateTime | null | undefined): string | null {
  return value?.toISO() ?? null
}

function person(user: Pick<User, 'id' | 'full_name' | 'email'> | null | undefined) {
  return user ? { id: user.id, full_name: user.full_name, email: user.email } : null
}

/**
 * Read side of the back-office "Organizações" queue.
 *
 * The lists come from the services the admin API uses — the organization
 * workflow and the claim service — so the page reads exactly what
 * `GET /api/v1/admin/organizations` and `/organization-claims` read, with the
 * same platform check. This service only adds what a moderator needs to
 * decide: who sent the organization, how many places it holds and the
 * recorded history. Every decision goes back through those services.
 */
@inject()
export default class OrganizationReviewPageService {
  constructor(
    private workflowService: OrganizationWorkflowService,
    private claimService: OrganizationClaimService,
    private policy: OrganizationPolicyService,
    private organizationRepository: OrganizationRepository,
    private permissionService: PermissionService
  ) {}

  async queue(
    tenantId: number,
    actor: User,
    status: IOrganization.Status = 'pending_review'
  ): Promise<OrganizationReviewQueuePageProps> {
    const all = await this.workflowService.listForReview(tenantId, actor)
    const claims = await this.claimService.listForReview(tenantId, actor, 'pending')
    const permissions = new Set(await this.permissionService.getEffectivePermissionNames(actor.id))

    const counts = Object.fromEntries(ORGANIZATION_STATUSES.map((value) => [value, 0])) as Record<
      IOrganization.Status,
      number
    >
    for (const organization of all) counts[organization.status] += 1

    const organizations = all
      .filter((organization) => organization.status === status)
      .sort(byLongestWaiting)
    const ids = organizations.map((organization) => organization.id)
    const places = await this.placeCounts(tenantId, ids)
    const submitters = await this.submitters(ids)
    const creators = await this.users(organizations.map((organization) => organization.created_by))

    return {
      status,
      counts,
      organizations: organizations.map((organization) => ({
        id: organization.id,
        trade_name: organization.trade_name,
        legal_name: organization.legal_name,
        tax_id: organization.tax_id,
        status: organization.status,
        submitted_at: iso(organization.submitted_at),
        submitted_by:
          submitters.get(organization.id) ??
          person(creators.get(organization.created_by ?? 0)) ??
          null,
        establishments: places.get(organization.id) ?? 0,
      })),
      claims: claims.map((claim): OrganizationClaimQueueRow => ({
        id: claim.id,
        created_at: iso(claim.created_at),
        message: claim.message,
        evidence_description: claim.evidence?.description?.trim() || null,
        document_count: claim.evidence?.document_file_ids?.length ?? 0,
        claimant: person(claim.claimant),
        organization: claim.organization
          ? {
              id: claim.organization.id,
              trade_name: claim.organization.trade_name,
              legal_name: claim.organization.legal_name,
              tax_id: claim.organization.tax_id,
              status: claim.organization.status,
            }
          : null,
      })),
      claim_decisions: {
        approve: permissions.has(
          permissionName(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.APPROVE)
        ),
        reject: permissions.has(
          permissionName(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.REJECT)
        ),
      },
    }
  }

  /** Pending organizations for "Hoje": the count and the ones waiting longest. */
  async pending(tenantId: number, actor: User) {
    const organizations = await this.workflowService.listForReview(
      tenantId,
      actor,
      'pending_review'
    )
    return organizations.sort(byLongestWaiting)
  }

  async show(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<OrganizationReviewPageProps> {
    await this.policy.requirePlatformModerator(actor)
    const organization = await this.organizationRepository.findByIdForTenant(
      tenantId,
      organizationId
    )
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    const permissions = new Set(await this.permissionService.getEffectivePermissionNames(actor.id))
    const inReview = organization.status === 'pending_review'
    const people = await this.users([organization.created_by, organization.reviewed_by])
    const submitters = await this.submitters([organization.id])
    const members = await OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organization.id)
      .preload('user')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    return {
      organization: {
        id: organization.id,
        legal_name: organization.legal_name,
        trade_name: organization.trade_name,
        slug: organization.slug,
        tax_id: organization.tax_id,
        email: organization.email,
        phone: organization.phone,
        website: organization.website,
        status: organization.status,
        created_at: iso(organization.created_at),
        submitted_at: iso(organization.submitted_at),
        reviewed_at: iso(organization.reviewed_at),
        review_notes: organization.review_notes,
        reviewed_by: people.get(organization.reviewed_by ?? 0)?.full_name ?? null,
      },
      submitted_by: submitters.get(organization.id) ?? null,
      created_by: person(people.get(organization.created_by ?? 0)),
      members: members.map((member) => ({
        id: member.id,
        full_name: member.user?.full_name ?? '',
        email: member.user?.email ?? '',
        role: member.role,
        status: member.status,
      })),
      establishments: await this.establishments(tenantId, organization.id),
      history: await this.history(organization.id),
      decisions: {
        approve:
          inReview &&
          permissions.has(
            permissionName(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.APPROVE)
          ),
        request_changes:
          inReview &&
          permissions.has(
            permissionName(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REQUEST_CHANGES)
          ),
        reject:
          inReview &&
          permissions.has(
            permissionName(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REJECT)
          ),
      },
    }
  }

  private async placeCounts(tenantId: number, organizationIds: number[]) {
    const counts = new Map<number, number>()
    if (organizationIds.length === 0) return counts

    const rows = await db
      .from('establishments')
      .where('tenant_id', tenantId)
      .whereIn('organization_id', organizationIds)
      .groupBy('organization_id')
      .select('organization_id')
      .count('* as total')
    for (const row of rows) counts.set(Number(row.organization_id), Number(row.total))
    return counts
  }

  /** The person who last sent each organization for review, as the audit trail recorded it. */
  private async submitters(organizationIds: number[]) {
    const submitters = new Map<number, OrganizationReviewPerson>()
    if (organizationIds.length === 0) return submitters

    const rows = await db
      .from('audit_logs')
      .join('users', 'users.id', 'audit_logs.user_id')
      .where('audit_logs.resource', IPermission.Resources.ORGANIZATIONS)
      .where('audit_logs.action', IPermission.Actions.SUBMIT)
      .where('audit_logs.result', 'granted')
      .where('audit_logs.reason', DOMAIN_AUDIT_REASON)
      .whereIn('audit_logs.resource_id', organizationIds)
      .orderBy('audit_logs.created_at', 'desc')
      .orderBy('audit_logs.id', 'desc')
      .select('audit_logs.resource_id', 'users.id', 'users.full_name', 'users.email')
    for (const row of rows) {
      const organizationId = Number(row.resource_id)
      if (submitters.has(organizationId)) continue
      submitters.set(organizationId, {
        id: Number(row.id),
        full_name: row.full_name,
        email: row.email,
      })
    }
    return submitters
  }

  private async users(ids: Array<number | null>) {
    const scoped = [...new Set(ids.filter((id): id is number => typeof id === 'number'))]
    const users = scoped.length ? await User.query().whereIn('id', scoped) : []
    return new Map(users.map((user) => [user.id, user]))
  }

  /** Every place of the organization with its latest version, published or not. */
  private async establishments(tenantId: number, organizationId: number) {
    const result = await db.rawQuery<{
      rows: Array<{
        id: number
        published_revision_id: number | null
        public_name: string | null
        revision_status: string | null
        city_name: string | null
      }>
    }>(
      `SELECT e.id, e.published_revision_id, r.public_name, r.status AS revision_status,
              c.name AS city_name
         FROM establishments e
         LEFT JOIN LATERAL (
           SELECT public_name, status, city_id
             FROM establishment_revisions
            WHERE establishment_id = e.id AND tenant_id = e.tenant_id
            ORDER BY version DESC
            LIMIT 1
         ) r ON TRUE
         LEFT JOIN cities c ON c.id = r.city_id AND c.tenant_id = e.tenant_id
        WHERE e.tenant_id = ? AND e.organization_id = ?
        ORDER BY e.created_at ASC, e.id ASC`,
      [tenantId, organizationId]
    )

    return result.rows.map((row) => ({
      id: Number(row.id),
      public_name: row.public_name?.trim() || null,
      city_name: row.city_name,
      revision_status: row.revision_status,
      published: row.published_revision_id !== null,
    }))
  }

  /**
   * What happened to the organization, newest first: creation, edits,
   * submissions and decisions, from the audit entries the organization
   * services write. A decision carries its reason.
   */
  private async history(organizationId: number): Promise<OrganizationReviewHistoryEntry[]> {
    const rows = await db
      .from('audit_logs')
      .leftJoin('users', 'users.id', 'audit_logs.user_id')
      .where('audit_logs.resource', IPermission.Resources.ORGANIZATIONS)
      .where('audit_logs.resource_id', organizationId)
      .where('audit_logs.result', 'granted')
      .where('audit_logs.reason', DOMAIN_AUDIT_REASON)
      .orderBy('audit_logs.created_at', 'desc')
      .orderBy('audit_logs.id', 'desc')
      .limit(50)
      .select(
        'audit_logs.id',
        'audit_logs.action',
        'audit_logs.metadata',
        'audit_logs.request_data',
        'audit_logs.created_at',
        'users.full_name'
      )

    return rows.map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>
      const requestData = (row.request_data ?? {}) as Record<string, unknown>
      const reason = [metadata.reason, requestData.reason].find(
        (value): value is string => typeof value === 'string' && value.trim() !== ''
      )
      const status = ORGANIZATION_STATUSES.find((value) => value === metadata.status) ?? null
      return {
        id: Number(row.id),
        action: String(row.action),
        status,
        reason: reason?.trim() ?? null,
        actor: row.full_name ?? null,
        at: row.created_at ? new Date(row.created_at).toISOString() : null,
      }
    })
  }
}

function timeOf(value: DateTime | null | undefined): number {
  return value?.toMillis() ?? Number.POSITIVE_INFINITY
}

/** Whatever was sent first is decided first; the creation date breaks ties. */
function byLongestWaiting(left: Organization, right: Organization): number {
  return (
    timeOf(left.submitted_at) - timeOf(right.submitted_at) ||
    timeOf(left.created_at) - timeOf(right.created_at) ||
    left.id - right.id
  )
}

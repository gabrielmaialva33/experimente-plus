import db from '@adonisjs/lucid/services/db'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import User from '#modules/users/models/user'

/** The reason `OrganizationAuditService` writes on every completed domain operation. */
const DOMAIN_AUDIT_REASON = 'Domain operation completed'

export interface OrganizationSubmissionRow {
  resource_id: number
  id: number
  full_name: string
  email: string
}

export interface OrganizationPlaceRow {
  id: number
  published_revision_id: number | null
  public_name: string | null
  revision_status: string | null
  city_name: string | null
}

export interface OrganizationHistoryRow {
  id: number
  action: string
  metadata: unknown
  request_data: unknown
  created_at: string | Date | null
  full_name: string | null
}

/**
 * Reads behind the back-office "Organizações" review pages: place counts, the
 * audit trail of submissions and decisions, and the people it names. Nothing
 * here decides; OrganizationReviewPageService shapes these rows for the page.
 */
export default class OrganizationReviewRepository {
  async countEstablishmentsByOrganization(
    tenantId: number,
    organizationIds: readonly number[]
  ): Promise<Array<{ organization_id: number; total: number }>> {
    const rows = await db
      .from('establishments')
      .where('tenant_id', tenantId)
      .whereIn('organization_id', [...organizationIds])
      .groupBy('organization_id')
      .select('organization_id')
      .count('* as total')

    return rows.map((row) => ({
      organization_id: Number(row.organization_id),
      total: Number(row.total),
    }))
  }

  /** Every recorded submission of these organizations, newest first. */
  async listSubmissions(organizationIds: readonly number[]): Promise<OrganizationSubmissionRow[]> {
    return db
      .from('audit_logs')
      .join('users', 'users.id', 'audit_logs.user_id')
      .where('audit_logs.resource', IPermission.Resources.ORGANIZATIONS)
      .where('audit_logs.action', IPermission.Actions.SUBMIT)
      .where('audit_logs.result', 'granted')
      .where('audit_logs.reason', DOMAIN_AUDIT_REASON)
      .whereIn('audit_logs.resource_id', [...organizationIds])
      .orderBy('audit_logs.created_at', 'desc')
      .orderBy('audit_logs.id', 'desc')
      .select('audit_logs.resource_id', 'users.id', 'users.full_name', 'users.email')
  }

  async listUsersByIds(ids: readonly number[]): Promise<User[]> {
    return User.query().whereIn('id', [...ids])
  }

  /** Every place of the organization with its latest version, published or not. */
  async listEstablishmentsWithLatestRevision(
    tenantId: number,
    organizationId: number
  ): Promise<OrganizationPlaceRow[]> {
    const result = await db.rawQuery<{ rows: OrganizationPlaceRow[] }>(
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

    return result.rows
  }

  /**
   * The organization's audit entries written by the organization services,
   * newest first, with the name of the person who acted.
   */
  async listHistory(organizationId: number): Promise<OrganizationHistoryRow[]> {
    return db
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
  }
}

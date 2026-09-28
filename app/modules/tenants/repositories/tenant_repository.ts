import db from '@adonisjs/lucid/services/db'
import LucidRepository from '#shared/lucid/lucid_repository'
import Tenant from '#modules/tenants/models/tenant'
import type ITenant from '#modules/tenants/interfaces/tenant_interface'
import type User from '#modules/users/models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class TenantRepository
  extends LucidRepository<typeof Tenant>
  implements ITenant.Repository
{
  constructor() {
    super(Tenant)
  }

  async countActiveForUser(userId: number): Promise<number> {
    const rows = await this.model
      .query()
      .where('is_active', true)
      .whereHas('users', (query) => query.where('users.id', userId))
      .count('* as total')

    return Number(rows[0].$extras.total)
  }

  async findActiveMembershipForUpdate(
    userId: number,
    tenantId: number,
    client: TransactionClientContract
  ): Promise<ITenant.ActiveMembership | null> {
    const tenant = await this.model
      .query({ client })
      .select('tenants.*')
      .select('user_tenants.role as membership_role')
      .innerJoin('user_tenants', 'user_tenants.tenant_id', 'tenants.id')
      .where('tenants.id', tenantId)
      .where('tenants.is_active', true)
      .where('user_tenants.user_id', userId)
      .forUpdate()
      .first()

    if (!tenant) {
      return null
    }

    return {
      tenant,
      role: String(tenant.$extras.membership_role),
    }
  }

  async findActiveById(
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<Tenant | null> {
    return this.model.query({ client }).where('id', tenantId).where('is_active', true).first()
  }

  async findActiveBySlug(slug: string): Promise<Tenant | null> {
    return this.model.query().where('slug', slug).where('is_active', true).first()
  }

  /** Active operations in primary-key order, capped at `limit`. */
  async listFirstActive(limit: number): Promise<Tenant[]> {
    return this.model.query().where('is_active', true).orderBy('id', 'asc').limit(limit)
  }

  /**
   * Every operation linked to the user, in primary-key order. The membership
   * role is exposed by the relation as `$extras.pivot_role`.
   */
  async listForUser(user: User): Promise<Tenant[]> {
    return user.related('tenants').query().orderBy('tenants.id', 'asc')
  }

  /** Like `listForUser`, restricted to active operations. */
  async listActiveForUser(user: User): Promise<Tenant[]> {
    return user
      .related('tenants')
      .query()
      .where('tenants.is_active', true)
      .orderBy('tenants.id', 'asc')
  }

  /** The user's lowest-id active operation. */
  async findFirstActiveForUser(user: User): Promise<Tenant | null> {
    return user
      .related('tenants')
      .query()
      .where('tenants.is_active', true)
      .orderBy('tenants.id', 'asc')
      .first()
  }

  /** Any operation linked to the user, active or not, without a defined order. */
  async findFirstForUser(user: User): Promise<Tenant | null> {
    return user.related('tenants').query().first()
  }

  async hasMember(
    tenantId: number,
    userId: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const membership = await (client ?? db)
      .from('user_tenants')
      .where('user_id', userId)
      .where('tenant_id', tenantId)
      .first()

    return Boolean(membership)
  }

  async attachMember(
    tenant: Tenant,
    userId: number,
    role: string,
    client?: TransactionClientContract
  ): Promise<void> {
    await tenant.related('users').attach({ [userId]: { role } }, client)
  }

  /** Inserts the membership row; a duplicate link fails on the pivot's key. */
  async insertMember(
    tenantId: number,
    userId: number,
    role: string,
    client: TransactionClientContract
  ): Promise<void> {
    const now = new Date()
    await client.table('user_tenants').insert({
      user_id: userId,
      tenant_id: tenantId,
      role,
      created_at: now,
      updated_at: now,
    })
  }

  /**
   * Inserts the membership row unless the link already exists, in which case
   * the existing role is kept. Returns whether a row was inserted.
   */
  async insertMemberIfAbsent(
    tenantId: number,
    userId: number,
    role: string,
    client: TransactionClientContract
  ): Promise<boolean> {
    const now = new Date()
    const inserted = await client
      .table('user_tenants')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['user_id', 'tenant_id'])
      .ignore()
      .returning('user_id')

    return inserted.length > 0
  }

  /** One active operation of the user, or null when it is not theirs or not active. */
  async findActiveForUser(user: User, tenantId: number): Promise<Tenant | null> {
    return user
      .related('tenants')
      .query()
      .where('tenants.id', tenantId)
      .where('tenants.is_active', true)
      .first()
  }
}

import LucidRepository from '#shared/lucid/lucid_repository'
import Tenant from '#modules/tenants/models/tenant'
import type ITenant from '#modules/tenants/interfaces/tenant_interface'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#modules/users/models/user'

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

  /** The user's active operations, in id order. */
  async listActiveForUser(user: User): Promise<Tenant[]> {
    return user
      .related('tenants')
      .query()
      .where('tenants.is_active', true)
      .orderBy('tenants.id', 'asc')
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

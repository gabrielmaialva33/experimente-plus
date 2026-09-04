import LucidRepository from '#shared/lucid/lucid_repository'
import Tenant from '#modules/tenants/models/tenant'
import type ITenant from '#modules/tenants/interfaces/tenant_interface'
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
}

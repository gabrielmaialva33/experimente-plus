import type LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import type Tenant from '#modules/tenants/models/tenant'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

namespace ITenant {
  export type ActiveMembership = {
    tenant: Tenant
    role: string
  }

  export interface Repository extends LucidRepositoryInterface<typeof Tenant> {
    countActiveForUser(userId: number): Promise<number>
    findActiveMembershipForUpdate(
      userId: number,
      tenantId: number,
      client: TransactionClientContract
    ): Promise<ActiveMembership | null>
  }
}

export default ITenant

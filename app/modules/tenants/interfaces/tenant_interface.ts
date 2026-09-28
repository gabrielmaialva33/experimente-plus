import type LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

namespace ITenant {
  export type ActiveMembership = {
    tenant: Tenant
    role: string
  }

  export type UserTenant = {
    id: number
    name: string
    slug: string
    is_active: boolean
    role: string
  }

  export interface Repository extends LucidRepositoryInterface<typeof Tenant> {
    countActiveForUser(userId: number): Promise<number>
    findActiveMembershipForUpdate(
      userId: number,
      tenantId: number,
      client: TransactionClientContract
    ): Promise<ActiveMembership | null>
    findActiveById(tenantId: number, client?: TransactionClientContract): Promise<Tenant | null>
    findActiveBySlug(slug: string): Promise<Tenant | null>
    listFirstActive(limit: number): Promise<Tenant[]>
    listForUser(user: User): Promise<Tenant[]>
    listActiveForUser(user: User): Promise<Tenant[]>
    findFirstActiveForUser(user: User): Promise<Tenant | null>
    findFirstForUser(user: User): Promise<Tenant | null>
    hasMember(
      tenantId: number,
      userId: number,
      client?: TransactionClientContract
    ): Promise<boolean>
    attachMember(
      tenant: Tenant,
      userId: number,
      role: string,
      client?: TransactionClientContract
    ): Promise<void>
    insertMember(
      tenantId: number,
      userId: number,
      role: string,
      client: TransactionClientContract
    ): Promise<void>
    insertMemberIfAbsent(
      tenantId: number,
      userId: number,
      role: string,
      client: TransactionClientContract
    ): Promise<boolean>
  }
}

export default ITenant

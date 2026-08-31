import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BenefitAccess from '#modules/benefits/models/benefit_access'

export default class BenefitAccessRepository {
  async listForTenant(tenantId: number): Promise<BenefitAccess[]> {
    return BenefitAccess.query()
      .where('tenant_id', tenantId)
      .preload('holder')
      .preload('granter')
      .preload('edition', (query) => query.preload('city'))
      .orderBy('granted_at', 'desc')
      .orderBy('id', 'desc')
  }

  async listForHolder(tenantId: number, userId: number): Promise<BenefitAccess[]> {
    return BenefitAccess.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .preload('edition', (editionQuery) => {
        editionQuery.preload('city').preload('offers', (offerQuery) => {
          offerQuery
            .where('status', 'active')
            .preload('establishment', (establishmentQuery) => {
              establishmentQuery.preload('published_revision')
            })
            .orderBy('created_at', 'asc')
        })
      })
      .orderBy('granted_at', 'desc')
      .orderBy('id', 'desc')
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<BenefitAccess | null> {
    return BenefitAccess.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('holder')
      .preload('edition', (query) => query.preload('city'))
      .first()
  }

  async findActive(
    tenantId: number,
    editionId: number,
    userId: number,
    client?: TransactionClientContract
  ): Promise<BenefitAccess | null> {
    return BenefitAccess.query({ client })
      .where('tenant_id', tenantId)
      .where('edition_id', editionId)
      .where('user_id', userId)
      .where('status', 'active')
      .first()
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitAccess | null> {
    return BenefitAccess.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async create(
    data: Partial<BenefitAccess>,
    client?: TransactionClientContract
  ): Promise<BenefitAccess> {
    return BenefitAccess.create(data, { client })
  }
}

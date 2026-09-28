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

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<BenefitAccess | null> {
    const query = BenefitAccess.query({ client }).where('tenant_id', tenantId).where('id', id)
    if (lock) query.forUpdate()
    return query.first()
  }

  /**
   * Lock the access row, failing with Lucid's row-not-found error when it is
   * missing. Without a tenant the lookup is by id alone.
   */
  async lockOrFail(
    id: number,
    client: TransactionClientContract,
    tenantId?: number
  ): Promise<BenefitAccess> {
    const query = BenefitAccess.query({ client }).where('id', id)
    if (tenantId !== undefined) query.where('tenant_id', tenantId)
    return query.forUpdate().firstOrFail()
  }

  /** The holder's access to the product (the edition, or one offer of it), in any status. */
  async findForHolderProduct(
    tenantId: number,
    editionId: number,
    userId: number,
    offerId: number | null,
    client?: TransactionClientContract
  ): Promise<BenefitAccess | null> {
    return BenefitAccess.query({ client })
      .where({ tenant_id: tenantId, edition_id: editionId, user_id: userId })
      .whereRaw('COALESCE(offer_id, 0) = ?', [offerId ?? 0])
      .first()
  }

  async findActive(
    tenantId: number,
    editionId: number,
    userId: number,
    client?: TransactionClientContract,
    offerId: number | null = null
  ): Promise<BenefitAccess | null> {
    return BenefitAccess.query({ client })
      .where('tenant_id', tenantId)
      .where('edition_id', editionId)
      .whereRaw('COALESCE(offer_id, 0) = ?', [offerId ?? 0])
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

import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BenefitRedemption from '#modules/benefits/models/benefit_redemption'

export default class BenefitRedemptionRepository {
  async findByNonceHash(
    tenantId: number,
    nonceHash: string,
    client?: TransactionClientContract
  ): Promise<BenefitRedemption | null> {
    return BenefitRedemption.query({ client })
      .where('tenant_id', tenantId)
      .where('presentation_nonce_hash', nonceHash)
      .first()
  }

  async findByIdForTenant(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<BenefitRedemption | null> {
    return BenefitRedemption.query({ client }).where('tenant_id', tenantId).where('id', id).first()
  }

  async findByReceiptForTenant(
    tenantId: number,
    receiptCode: string
  ): Promise<BenefitRedemption | null> {
    return BenefitRedemption.query()
      .where('tenant_id', tenantId)
      .where('receipt_code', receiptCode)
      .first()
  }

  async countForAccessOffer(
    tenantId: number,
    accessId: number,
    offerId: number,
    client?: TransactionClientContract
  ): Promise<number> {
    const row = await BenefitRedemption.query({ client })
      .where('tenant_id', tenantId)
      .where('access_id', accessId)
      .where('offer_id', offerId)
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async listForHolder(tenantId: number, userId: number): Promise<BenefitRedemption[]> {
    return BenefitRedemption.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .orderBy('redeemed_at', 'desc')
      .orderBy('id', 'desc')
  }

  async listForOrganizations(
    tenantId: number,
    organizationIds: number[]
  ): Promise<BenefitRedemption[]> {
    if (organizationIds.length === 0) {
      return []
    }

    return BenefitRedemption.query()
      .where('tenant_id', tenantId)
      .whereIn('organization_id', organizationIds)
      .orderBy('redeemed_at', 'desc')
      .orderBy('id', 'desc')
  }

  async create(
    data: Partial<BenefitRedemption>,
    client: TransactionClientContract
  ): Promise<BenefitRedemption> {
    return BenefitRedemption.create(data, { client })
  }
}

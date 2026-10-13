import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IBenefitSavings from '#modules/benefits/interfaces/benefit_savings_interface'
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

  /** Every use of the access, across its offers. */
  async countForAccess(
    tenantId: number,
    accessId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const uses = await client
      .from('benefit_redemptions')
      .where({ tenant_id: tenantId, access_id: accessId })
      .count('* as total')
      .first()

    return Number(uses?.total)
  }

  /** The receipts of the access as plain rows: id, receipt code and redemption time. */
  async listReceiptsForAccess(tenantId: number, accessId: number) {
    return db
      .from('benefit_redemptions')
      .select('id', 'receipt_code', 'redeemed_at')
      .where({ tenant_id: tenantId, access_id: accessId })
  }

  async listForHolder(tenantId: number, userId: number): Promise<BenefitRedemption[]> {
    return BenefitRedemption.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .orderBy('redeemed_at', 'desc')
      .orderBy('id', 'desc')
  }

  /**
   * The holder's uses in the operation, each with what its savings are read
   * from: the offer as it is now (the use keeps no copy of the discount) and
   * the edition with its city's clock. Plain rows, newest use first.
   */
  async listSavingsRowsForHolder(
    tenantId: number,
    userId: number
  ): Promise<IBenefitSavings.RedemptionRow[]> {
    return db
      .from('benefit_redemptions as redemption')
      .join('benefit_offers as offer', (join) => {
        join.on('offer.id', 'redemption.offer_id').andOn('offer.tenant_id', 'redemption.tenant_id')
      })
      .join('benefit_editions as edition', (join) => {
        join
          .on('edition.id', 'redemption.edition_id')
          .andOn('edition.tenant_id', 'redemption.tenant_id')
      })
      .join('cities as city', (join) => {
        join.on('city.id', 'edition.city_id').andOn('city.tenant_id', 'edition.tenant_id')
      })
      .where('redemption.tenant_id', tenantId)
      .where('redemption.user_id', userId)
      .select(
        'redemption.id',
        'redemption.edition_id',
        'redemption.establishment_id',
        'redemption.establishment_name_snapshot',
        'redemption.benefit_type_snapshot',
        'redemption.redeemed_at',
        'offer.benefit_type as offer_benefit_type',
        'offer.discount_percentage',
        'offer.discount_amount_cents',
        'edition.name as edition_name',
        'edition.usage_starts_at as edition_usage_starts_at',
        'edition.usage_ends_at as edition_usage_ends_at',
        'city.timezone as city_timezone'
      )
      .orderBy('redemption.redeemed_at', 'desc')
      .orderBy('redemption.id', 'desc')
  }

  async listForTenant(tenantId: number): Promise<BenefitRedemption[]> {
    return BenefitRedemption.query()
      .where('tenant_id', tenantId)
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

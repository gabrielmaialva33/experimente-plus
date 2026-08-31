import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BenefitOffer from '#modules/benefits/models/benefit_offer'

export default class BenefitOfferRepository {
  async listForEstablishment(tenantId: number, establishmentId: number): Promise<BenefitOffer[]> {
    const offers = await BenefitOffer.query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .orderBy('created_at', 'desc')

    for (const offer of offers) {
      await offer.load('edition')
      await offer.edition.load('city')
    }

    return offers
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<BenefitOffer | null> {
    const offer = await BenefitOffer.query().where('tenant_id', tenantId).where('id', id).first()

    if (!offer) {
      return null
    }

    await offer.load('edition')
    await offer.edition.load('city')
    await offer.load('establishment')
    await offer.establishment.load('organization')
    await offer.establishment.load('published_revision')

    return offer
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitOffer | null> {
    return BenefitOffer.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async existsForEditionEstablishment(
    editionId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    return Boolean(
      await BenefitOffer.query({ client })
        .where('edition_id', editionId)
        .where('establishment_id', establishmentId)
        .first()
    )
  }

  async countForEdition(tenantId: number, editionId: number): Promise<number> {
    const row = await BenefitOffer.query()
      .where('tenant_id', tenantId)
      .where('edition_id', editionId)
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async countActiveForEdition(
    tenantId: number,
    editionId: number,
    client?: TransactionClientContract
  ): Promise<number> {
    const row = await BenefitOffer.query({ client })
      .where('tenant_id', tenantId)
      .where('edition_id', editionId)
      .where('status', 'active')
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async create(
    data: Partial<BenefitOffer>,
    client?: TransactionClientContract
  ): Promise<BenefitOffer> {
    return BenefitOffer.create(data, { client })
  }
}

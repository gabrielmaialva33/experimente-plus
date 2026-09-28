import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'

import BenefitOffer from '#modules/benefits/models/benefit_offer'
import type Establishment from '#modules/establishments/models/establishment'

/** The establishment is active, published and not permanently closed. */
function whereEstablishmentDeliverable(
  query: ModelQueryBuilderContract<typeof Establishment>
): void {
  query
    .where('lifecycle_status', 'active')
    .whereNotNull('published_revision_id')
    .whereNot('business_status', 'permanently_closed')
}

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

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<BenefitOffer | null> {
    const query = BenefitOffer.query({ client }).where('tenant_id', tenantId).where('id', id)
    if (lock) query.forUpdate()
    return query.first()
  }

  async findInEdition(
    tenantId: number,
    editionId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<BenefitOffer | null> {
    return BenefitOffer.query({ client })
      .where({
        id,
        tenant_id: tenantId,
        edition_id: editionId,
      })
      .first()
  }

  async existsForEdition(
    tenantId: number,
    editionId: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    return Boolean(
      await BenefitOffer.query({ client })
        .where('tenant_id', tenantId)
        .where('edition_id', editionId)
        .first()
    )
  }

  /**
   * The edition's active offers still on sale at deliverable establishments,
   * with the establishment and its published revision, by id. Pass an offer id
   * to read only that offer.
   */
  async listSellableForEdition(
    tenantId: number,
    editionId: number,
    client?: TransactionClientContract,
    offerId: number | null = null
  ): Promise<BenefitOffer[]> {
    const query = BenefitOffer.query({ client })
      .where('tenant_id', tenantId)
      .where('edition_id', editionId)
      .where('status', 'active')
      .whereHas('establishment', whereEstablishmentDeliverable)
      .where((q) => q.whereNull('ends_at').orWhere('ends_at', '>', DateTime.utc().toJSDate()))
      .preload('establishment', (q) => q.preload('published_revision'))
      .orderBy('id')
    if (offerId !== null) query.where('id', offerId)
    return query
  }

  /** The offer, active or paused, at a deliverable establishment. */
  async findDeliverable(
    tenantId: number,
    editionId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitOffer | null> {
    return BenefitOffer.query({ client })
      .where({ id, edition_id: editionId, tenant_id: tenantId })
      .whereIn('status', ['active', 'paused'])
      .whereHas('establishment', whereEstablishmentDeliverable)
      .first()
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

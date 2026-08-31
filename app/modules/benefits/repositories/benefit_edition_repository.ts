import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BenefitEdition from '#modules/benefits/models/benefit_edition'

export default class BenefitEditionRepository {
  async listForTenant(tenantId: number): Promise<BenefitEdition[]> {
    const editions = await BenefitEdition.query()
      .where('tenant_id', tenantId)
      .orderBy('usage_starts_at', 'desc')
      .orderBy('id', 'desc')

    for (const edition of editions) {
      await edition.load('city')
      await edition.load('offers', (query) => query.orderBy('created_at', 'asc'))
      await edition.load('accesses', (query) => query.orderBy('created_at', 'asc'))
    }

    return editions
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<BenefitEdition | null> {
    const edition = await BenefitEdition.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .first()

    if (!edition) {
      return null
    }

    await edition.load('city')
    await edition.load('offers', (query) => {
      query.orderBy('created_at', 'asc')
    })
    await edition.load('accesses', (query) => {
      query.orderBy('created_at', 'asc')
    })

    for (const offer of edition.offers) {
      await offer.load('establishment', async (establishmentQuery) => {
        establishmentQuery.preload('organization')
      })
      await offer.establishment.load('published_revision')
    }

    return edition
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitEdition | null> {
    return BenefitEdition.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async isSlugTaken(
    tenantId: number,
    slug: string,
    excludeId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const query = BenefitEdition.query({ client }).where('tenant_id', tenantId).where('slug', slug)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(
    data: Partial<BenefitEdition>,
    client?: TransactionClientContract
  ): Promise<BenefitEdition> {
    return BenefitEdition.create(data, { client })
  }
}

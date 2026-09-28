import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BenefitEdition from '#modules/benefits/models/benefit_edition'

export default class BenefitEditionRepository {
  async listAvailableForTenant(tenantId: number): Promise<BenefitEdition[]> {
    return BenefitEdition.query()
      .where('tenant_id', tenantId)
      .whereNot('status', 'archived')
      .select([
        'id',
        'city_id',
        'name',
        'slug',
        'description',
        'price_cents',
        'currency',
        'sales_starts_at',
        'sales_ends_at',
        'usage_starts_at',
        'usage_ends_at',
        'status',
        'published_at',
      ])
      .preload('city', (query) => query.select(['id', 'name', 'state_code']))
      .orderBy('usage_starts_at', 'desc')
      .orderBy('id', 'desc')
  }

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

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<BenefitEdition | null> {
    return BenefitEdition.query({ client }).where('tenant_id', tenantId).where('id', id).first()
  }

  /**
   * Published BRL editions on sale at `now` whose sales close no later than
   * their usage, priced as a package or through a standalone offer, with the
   * city, by id and capped at 100.
   */
  async listOnSaleForTenant(tenantId: number, now: Date): Promise<BenefitEdition[]> {
    return BenefitEdition.query()
      .where('tenant_id', tenantId)
      .where('status', 'published')
      .where('usage_ends_at', '>', now)
      .where('sales_starts_at', '<=', now)
      .where('sales_ends_at', '>', now)
      .whereColumn('sales_ends_at', '<=', 'usage_ends_at')
      .where('currency', 'BRL')
      .where((q) =>
        q
          .where('price_cents', '>', 0)
          .orWhereHas('offers', (o) => o.where('standalone_price_cents', '>', 0))
      )
      .preload('city')
      .orderBy('id')
      .limit(100)
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

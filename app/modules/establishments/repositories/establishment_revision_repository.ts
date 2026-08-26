import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import LucidRepository from '#shared/lucid/lucid_repository'

const OPEN_REVISION_STATUSES = ['draft', 'pending_review', 'changes_requested'] as const
const EDITABLE_REVISION_STATUSES = ['draft', 'changes_requested'] as const

export default class EstablishmentRevisionRepository extends LucidRepository<
  typeof EstablishmentRevision
> {
  constructor() {
    super(EstablishmentRevision)
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<EstablishmentRevision | null> {
    return EstablishmentRevision.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findEditableForEstablishment(
    tenantId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .whereIn('status', [...EDITABLE_REVISION_STATUSES])
      .orderBy('version', 'desc')
      .first()
  }

  async findOpenForEstablishment(
    tenantId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .whereIn('status', [...OPEN_REVISION_STATUSES])
      .orderBy('version', 'desc')
      .first()
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    return EstablishmentRevision.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async findLockedForEstablishment(
    tenantId: number,
    establishmentId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    return EstablishmentRevision.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .whereIn('status', [...OPEN_REVISION_STATUSES])
      .orderBy('version', 'desc')
      .forUpdate()
      .first()
  }

  async nextVersion(establishmentId: number, client: TransactionClientContract): Promise<number> {
    const row = await EstablishmentRevision.query({ client })
      .where('establishment_id', establishmentId)
      .max('version as max_version')
      .first()

    return Number(row?.$extras.max_version ?? 0) + 1
  }

  async isOpenSlugTaken(
    tenantId: number,
    cityId: number | null,
    slug: string,
    excludeRevisionId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()

    query
      .where('tenant_id', tenantId)
      .where('slug', slug)
      .whereIn('status', [...OPEN_REVISION_STATUSES])

    if (cityId === null) {
      query.whereNull('city_id')
    } else {
      query.where('city_id', cityId)
    }

    if (excludeRevisionId !== undefined) {
      query.whereNot('id', excludeRevisionId)
    }

    return Boolean(await query.first())
  }

  async isSlugTaken(
    tenantId: number,
    cityId: number | null,
    slug: string,
    excludeRevisionId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    return this.isOpenSlugTaken(tenantId, cityId, slug, excludeRevisionId, client)
  }

  async findAggregate(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()

    const revision = await query.where('tenant_id', tenantId).where('id', id).first()
    if (!revision) {
      return null
    }

    await revision.load('city')
    await revision.load('address')
    await revision.load('hours')
    await revision.load('special_days', (specialDayQuery) => specialDayQuery.preload('intervals'))
    await revision.load('categories', (categoryQuery) => categoryQuery.preload('category'))
    await revision.load('attribute_values', (valueQuery) => valueQuery.preload('definition'))
    await this.loadSelectedAttributeOptions(tenantId, revision, client)
    await revision.load('media', (mediaQuery) =>
      mediaQuery
        .preload('asset', (assetQuery) => assetQuery.preload('file'))
        .orderBy('is_cover', 'desc')
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
    )

    return revision
  }

  private async loadSelectedAttributeOptions(
    tenantId: number,
    revision: EstablishmentRevision,
    client?: TransactionClientContract
  ): Promise<void> {
    const valueIds = revision.attribute_values.map((value) => value.id)
    if (valueIds.length === 0) {
      return
    }

    const query = client
      ? EstablishmentRevisionAttributeValueOption.query({ client })
      : EstablishmentRevisionAttributeValueOption.query()
    const selectedOptions = await query
      .where('tenant_id', tenantId)
      .whereIn('attribute_value_id', valueIds)
      .preload('option')
      .orderBy('id', 'asc')
    const optionsByValue = new Map<number, EstablishmentRevisionAttributeValueOption[]>()

    for (const selectedOption of selectedOptions) {
      const options = optionsByValue.get(selectedOption.attribute_value_id) ?? []
      options.push(selectedOption)
      optionsByValue.set(selectedOption.attribute_value_id, options)
    }

    for (const value of revision.attribute_values) {
      value.$setRelated('selected_options', optionsByValue.get(value.id) ?? [])
    }
  }
}

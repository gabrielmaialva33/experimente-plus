import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
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

    return query
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('city')
      .preload('address')
      .preload('hours')
      .preload('special_days', (specialDayQuery) => specialDayQuery.preload('intervals'))
      .preload('categories', (categoryQuery) => categoryQuery.preload('category'))
      .preload('attribute_values', (valueQuery) => {
        valueQuery.preload('definition')
        valueQuery.preload('selected_options', (optionQuery) => optionQuery.preload('option'))
      })
      .preload('media')
      .first()
  }
}

import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import LucidRepository from '#shared/lucid/lucid_repository'

const OPEN_REVISION_STATUSES = ['draft', 'pending_review', 'changes_requested'] as const
const EDITABLE_REVISION_STATUSES = ['draft', 'changes_requested'] as const

interface SlugAvailabilityOptions {
  excludeRevisionId?: number
  excludeEstablishmentId?: number
  client?: TransactionClientContract
}

interface PublishedSlugCandidate {
  revision_id: number
  establishment_id: number
  city_id: number | null
  slug: string
}

export function resolveCurrentEstablishmentRevision(
  tenantId: number,
  establishmentId: number,
  publishedRevisionId: number | null,
  revisions: readonly EstablishmentRevision[],
  publishedRevision: EstablishmentRevision | null,
  rejectedRevision?: EstablishmentRevision | null
): EstablishmentRevision | null {
  const scopedRevisions = revisions.filter(
    (revision) => revision.tenant_id === tenantId && revision.establishment_id === establishmentId
  )
  const openRevision = scopedRevisions
    .filter((revision) =>
      OPEN_REVISION_STATUSES.includes(revision.status as (typeof OPEN_REVISION_STATUSES)[number])
    )
    .sort((left, right) => right.version - left.version || right.id - left.id)[0]
  if (openRevision) {
    return openRevision
  }

  if (publishedRevisionId !== null) {
    return publishedRevision?.tenant_id === tenantId &&
      publishedRevision.establishment_id === establishmentId &&
      publishedRevision.id === publishedRevisionId
      ? publishedRevision
      : null
  }

  const latestRejected =
    rejectedRevision ??
    scopedRevisions
      .filter((revision) => revision.status === 'rejected')
      .sort((left, right) => right.version - left.version || right.id - left.id)[0]

  return latestRejected?.tenant_id === tenantId &&
    latestRejected.establishment_id === establishmentId &&
    latestRejected.status === 'rejected'
    ? latestRejected
    : null
}

export default class EstablishmentRevisionRepository extends LucidRepository<
  typeof EstablishmentRevision
> {
  constructor() {
    super(EstablishmentRevision)
  }

  async findByIdForTenant(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()
    return query.where('tenant_id', tenantId).where('id', id).first()
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
      .orderBy('id', 'desc')
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
      .orderBy('id', 'desc')
      .first()
  }

  async findLatestRejectedForEstablishment(
    tenantId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('status', 'rejected')
      .orderBy('version', 'desc')
      .orderBy('id', 'desc')
      .first()
  }

  /**
   * Resolves the revision exposed by management APIs. An open revision always
   * wins; a rejected revision is only a fallback for an establishment that has
   * never published. Every lookup remains scoped to the tenant and establishment.
   */
  async findCurrentForEstablishment(
    tenantId: number,
    establishmentId: number,
    publishedRevisionId: number | null,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevision | null> {
    const openRevision = await this.findOpenForEstablishment(tenantId, establishmentId, client)
    if (openRevision) {
      return openRevision
    }

    let publishedRevision: EstablishmentRevision | null = null
    let rejectedRevision: EstablishmentRevision | null = null
    if (publishedRevisionId !== null) {
      const query = client ? EstablishmentRevision.query({ client }) : EstablishmentRevision.query()
      publishedRevision = await query
        .where('tenant_id', tenantId)
        .where('establishment_id', establishmentId)
        .where('id', publishedRevisionId)
        .first()
    } else {
      rejectedRevision = await this.findLatestRejectedForEstablishment(
        tenantId,
        establishmentId,
        client
      )
    }

    return this.resolveCurrentFromLoaded(
      tenantId,
      establishmentId,
      publishedRevisionId,
      [],
      publishedRevision,
      rejectedRevision
    )
  }

  resolveCurrentFromLoaded(
    tenantId: number,
    establishmentId: number,
    publishedRevisionId: number | null,
    revisions: readonly EstablishmentRevision[],
    publishedRevision: EstablishmentRevision | null,
    rejectedRevision?: EstablishmentRevision | null
  ): EstablishmentRevision | null {
    return resolveCurrentEstablishmentRevision(
      tenantId,
      establishmentId,
      publishedRevisionId,
      revisions,
      publishedRevision,
      rejectedRevision
    )
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
      .orderBy('id', 'desc')
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
    options: SlugAvailabilityOptions = {}
  ): Promise<boolean> {
    if (
      await this.isOpenSlugTaken(tenantId, cityId, slug, options.excludeRevisionId, options.client)
    ) {
      return true
    }

    return this.isPublishedSlugTaken(
      tenantId,
      cityId,
      slug,
      options.excludeEstablishmentId,
      options.client
    )
  }

  async isPublishedSlugTaken(
    tenantId: number,
    cityId: number | null,
    slug: string,
    excludeEstablishmentId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const probeRevisionId = 0
    const conflicts = await this.findPublishedSlugConflictRevisionIds(
      tenantId,
      [
        {
          revision_id: probeRevisionId,
          establishment_id: excludeEstablishmentId ?? 0,
          city_id: cityId,
          slug,
        },
      ],
      client
    )

    return conflicts.has(probeRevisionId)
  }

  async findPublishedSlugConflictRevisionIds(
    tenantId: number,
    candidates: readonly PublishedSlugCandidate[],
    client?: TransactionClientContract
  ): Promise<Set<number>> {
    if (candidates.length === 0) {
      return new Set()
    }

    // The published pointer reserves the public URL even while an establishment
    // is suspended or archived. This keeps a future restore deterministic and
    // mirrors the source of truth used to rebuild the catalog projection.
    const query = client
      ? client.from('establishments as published_establishment')
      : db.from('establishments as published_establishment')

    const slugs = [...new Set(candidates.map((candidate) => candidate.slug))]
    const cityIds = [
      ...new Set(
        candidates.flatMap((candidate) => (candidate.city_id === null ? [] : [candidate.city_id]))
      ),
    ]
    const includesNullCity = candidates.some((candidate) => candidate.city_id === null)

    query
      .innerJoin('establishment_revisions as published_revision', (join) => {
        join
          .on('published_revision.id', '=', 'published_establishment.published_revision_id')
          .andOn('published_revision.tenant_id', '=', 'published_establishment.tenant_id')
          .andOn('published_revision.establishment_id', '=', 'published_establishment.id')
      })
      .where('published_establishment.tenant_id', tenantId)
      .whereIn('published_revision.slug', slugs)
      .where((cityQuery) => {
        if (cityIds.length > 0) {
          cityQuery.whereIn('published_revision.city_id', cityIds)
        }
        if (includesNullCity) {
          if (cityIds.length > 0) {
            cityQuery.orWhereNull('published_revision.city_id')
          } else {
            cityQuery.whereNull('published_revision.city_id')
          }
        }
      })

    const publishedOwners = await query.select([
      'published_establishment.id as establishment_id',
      'published_revision.city_id as city_id',
      'published_revision.slug as slug',
    ])
    const ownerIdsByScope = new Map<string, Set<number>>()

    for (const owner of publishedOwners) {
      const cityIdValue = owner.city_id === null ? null : Number(owner.city_id)
      const key = this.slugScopeKey(cityIdValue, String(owner.slug))
      const ownerIds = ownerIdsByScope.get(key) ?? new Set<number>()
      ownerIds.add(Number(owner.establishment_id))
      ownerIdsByScope.set(key, ownerIds)
    }

    const conflicts = new Set<number>()
    for (const candidate of candidates) {
      const ownerIds = ownerIdsByScope.get(this.slugScopeKey(candidate.city_id, candidate.slug))
      if ([...(ownerIds ?? [])].some((ownerId) => ownerId !== candidate.establishment_id)) {
        conflicts.add(candidate.revision_id)
      }
    }

    return conflicts
  }

  async lockSlugForPublication(
    tenantId: number,
    cityId: number | null,
    slug: string,
    client: TransactionClientContract
  ): Promise<void> {
    const scopedSlug = `${cityId === null ? 'without-city' : cityId}:${slug}`

    await client.rawQuery('SELECT pg_advisory_xact_lock(CAST(? AS integer), hashtext(?))', [
      tenantId,
      scopedSlug,
    ])
  }

  private slugScopeKey(cityId: number | null, slug: string): string {
    return `${cityId === null ? 'without-city' : cityId}:${slug}`
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

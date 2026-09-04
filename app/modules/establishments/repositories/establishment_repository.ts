import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import { resolveCurrentEstablishmentRevision } from '#modules/establishments/repositories/establishment_revision_repository'
import StoredFile from '#modules/files/models/file'
import Category from '#modules/taxonomy/models/category'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import LucidRepository from '#shared/lucid/lucid_repository'

const OPEN_REVISION_STATUSES = ['draft', 'pending_review', 'changes_requested'] as const

export default class EstablishmentRepository extends LucidRepository<typeof Establishment> {
  constructor() {
    super(Establishment)
  }

  async listForOrganization(tenantId: number, organizationId: number): Promise<Establishment[]> {
    const establishments = await Establishment.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    await this.loadCurrentRevisionCandidates(tenantId, establishments)
    return establishments
  }

  async listByOrganization(tenantId: number, organizationId: number): Promise<Establishment[]> {
    return this.listForOrganization(tenantId, organizationId)
  }

  /**
   * Loads the Portal overview projection in a fixed set of relation queries.
   * The organization ids must come from an authorization-aware service and the
   * tenant predicate remains mandatory so the batch fails closed at the query boundary.
   */
  async listForAuthorizedOrganizations(
    tenantId: number,
    organizationIds: readonly number[]
  ): Promise<Establishment[]> {
    const scopedOrganizationIds = [...new Set(organizationIds)]
    if (scopedOrganizationIds.length === 0) {
      return []
    }

    const establishments = await Establishment.query()
      .where('tenant_id', tenantId)
      .whereIn('organization_id', scopedOrganizationIds)
      .select([
        'id',
        'tenant_id',
        'organization_id',
        'lifecycle_status',
        'business_status',
        'published_revision_id',
        'created_at',
      ])
      .orderBy('organization_id', 'asc')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    await this.loadCompletenessAggregates(tenantId, establishments, false)
    return establishments
  }

  /**
   * Loads one already-authorized Portal establishment without widening the
   * query to every establishment owned by the actor's organizations. A null
   * organization scope represents tenant-wide platform administration; an
   * empty scope represents no authorized organization.
   */
  async findForAuthorizedOrganization(
    tenantId: number,
    establishmentId: number,
    organizationIds: readonly number[] | null
  ): Promise<Establishment | null> {
    const scopedOrganizationIds = organizationIds === null ? null : [...new Set(organizationIds)]
    if (scopedOrganizationIds?.length === 0) {
      return null
    }

    const query = Establishment.query().where('tenant_id', tenantId).where('id', establishmentId)
    if (scopedOrganizationIds) {
      query.whereIn('organization_id', scopedOrganizationIds)
    }
    const establishment = await query.first()
    if (!establishment) {
      return null
    }

    await this.loadCompletenessAggregates(tenantId, [establishment], true)
    return establishment
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<Establishment | null> {
    return Establishment.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findByIdForTenantWithDetails(tenantId: number, id: number): Promise<Establishment | null> {
    return Establishment.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('organization')
      .preload('published_revision', (query) => this.preloadRevisionAggregate(query))
      .preload('revisions', (query) => {
        query
          .whereIn('status', ['draft', 'pending_review', 'changes_requested'])
          .orderBy('version', 'desc')
          .limit(1)
        this.preloadRevisionAggregate(query)
      })
      .first()
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<Establishment | null> {
    return Establishment.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async lockByIdForTenant(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<Establishment | null> {
    return this.findLocked(tenantId, id, client)
  }

  private preloadRevisionAggregate(query: any): void {
    query
      .preload('city')
      .preload('address')
      .preload('hours')
      .preload('special_days', (specialDayQuery: any) => specialDayQuery.preload('intervals'))
      .preload('categories', (categoryQuery: any) => categoryQuery.preload('category'))
      .preload('attribute_values', (valueQuery: any) => {
        valueQuery.preload('definition')
        valueQuery.preload('selected_options', (optionQuery: any) => optionQuery.preload('option'))
      })
  }

  private async loadCurrentRevisionCandidates(
    tenantId: number,
    establishments: readonly Establishment[],
    revisionColumns?: string[]
  ): Promise<EstablishmentRevision[]> {
    if (establishments.length === 0) {
      return []
    }

    const establishmentIds = establishments.map((establishment) => establishment.id)
    const openRevisionQuery = EstablishmentRevision.query()
      .distinctOn('establishment_id')
      .where('tenant_id', tenantId)
      .whereIn('establishment_id', establishmentIds)
      .whereIn('status', [...OPEN_REVISION_STATUSES])
      .orderBy('establishment_id', 'asc')
      .orderBy('version', 'desc')
      .orderBy('id', 'desc')
    if (revisionColumns) {
      openRevisionQuery.select(revisionColumns)
    }
    const openRevisions = await openRevisionQuery
    const openByEstablishment = new Map(
      openRevisions.map((revision) => [revision.establishment_id, revision])
    )

    const publishedRevisionIds = establishments.flatMap((establishment) =>
      establishment.published_revision_id === null ? [] : [establishment.published_revision_id]
    )
    let publishedRevisions: EstablishmentRevision[] = []
    if (publishedRevisionIds.length > 0) {
      const publishedRevisionQuery = EstablishmentRevision.query()
        .where('tenant_id', tenantId)
        .whereIn('establishment_id', establishmentIds)
        .whereIn('id', publishedRevisionIds)
      if (revisionColumns) {
        publishedRevisionQuery.select(revisionColumns)
      }
      publishedRevisions = await publishedRevisionQuery
    }
    const publishedById = new Map(publishedRevisions.map((revision) => [revision.id, revision]))

    const rejectedFallbackEstablishmentIds = establishments
      .filter(
        (establishment) =>
          establishment.published_revision_id === null && !openByEstablishment.has(establishment.id)
      )
      .map((establishment) => establishment.id)
    let rejectedRevisions: EstablishmentRevision[] = []
    if (rejectedFallbackEstablishmentIds.length > 0) {
      const rejectedRevisionQuery = EstablishmentRevision.query()
        .distinctOn('establishment_id')
        .where('tenant_id', tenantId)
        .whereIn('establishment_id', rejectedFallbackEstablishmentIds)
        .where('status', 'rejected')
        .orderBy('establishment_id', 'asc')
        .orderBy('version', 'desc')
        .orderBy('id', 'desc')
      if (revisionColumns) {
        rejectedRevisionQuery.select(revisionColumns)
      }
      rejectedRevisions = await rejectedRevisionQuery
    }
    const rejectedByEstablishment = new Map(
      rejectedRevisions.map((revision) => [revision.establishment_id, revision])
    )

    const selectedById = new Map<number, EstablishmentRevision>()
    for (const establishment of establishments) {
      const openRevision = openByEstablishment.get(establishment.id) ?? null
      const publishedRevision =
        establishment.published_revision_id === null
          ? null
          : (publishedById.get(establishment.published_revision_id) ?? null)
      const rejectedRevision = rejectedByEstablishment.get(establishment.id) ?? null
      const currentRevision = resolveCurrentEstablishmentRevision(
        tenantId,
        establishment.id,
        establishment.published_revision_id,
        openRevision ? [openRevision] : [],
        publishedRevision,
        rejectedRevision
      )

      establishment.$setRelated(
        'revisions',
        currentRevision && currentRevision.id !== publishedRevision?.id ? [currentRevision] : []
      )
      establishment.$setRelated('published_revision', publishedRevision)
      if (currentRevision) {
        selectedById.set(currentRevision.id, currentRevision)
      }
    }

    return [...selectedById.values()]
  }

  /**
   * Lucid executes sibling preloads concurrently. That is unsafe when the test
   * suite installs a global transaction client and also makes query counts
   * opaque. Resolve each relation as one tenant-scoped batch, in sequence, and
   * attach only the revision selected by the Portal projection.
   */
  private async loadCompletenessAggregates(
    tenantId: number,
    establishments: readonly Establishment[],
    includeEditorDetails: boolean
  ): Promise<void> {
    if (establishments.length === 0) {
      return
    }

    const revisions = await this.loadCurrentRevisionCandidates(
      tenantId,
      establishments,
      includeEditorDetails ? undefined : this.completenessRevisionColumns()
    )
    const revisionIds = revisions.map((revision) => revision.id)
    if (revisionIds.length === 0) {
      return
    }

    const addressQuery = EstablishmentRevisionAddress.query()
      .where('tenant_id', tenantId)
      .whereIn('revision_id', revisionIds)
    if (!includeEditorDetails) {
      addressQuery.select([
        'id',
        'tenant_id',
        'revision_id',
        'street',
        'number',
        'without_number',
        'district',
        'latitude',
        'longitude',
      ])
    }
    const addresses = await addressQuery
    const addressByRevision = new Map(addresses.map((address) => [address.revision_id, address]))

    const hourQuery = EstablishmentRevisionHour.query()
      .where('tenant_id', tenantId)
      .whereIn('revision_id', revisionIds)
      .orderBy('revision_id', 'asc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    if (!includeEditorDetails) {
      hourQuery.select(['id', 'tenant_id', 'revision_id'])
    }
    const hours = await hourQuery
    const hoursByRevision = this.groupBy(hours, (hour) => hour.revision_id)

    const revisionCategories = await EstablishmentRevisionCategory.query()
      .where('tenant_id', tenantId)
      .whereIn('revision_id', revisionIds)
      .select(['id', 'tenant_id', 'revision_id', 'category_id', 'is_primary', 'sort_order'])
      .orderBy('revision_id', 'asc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    const categoryIds = [...new Set(revisionCategories.map((item) => item.category_id))]
    const categories =
      categoryIds.length > 0
        ? await Category.query()
            .where('tenant_id', tenantId)
            .whereIn('id', categoryIds)
            .select(['id', 'tenant_id', 'is_active'])
        : []
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    for (const revisionCategory of revisionCategories) {
      revisionCategory.$setRelated(
        'category',
        categoryById.get(revisionCategory.category_id) ?? null
      )
    }
    const categoriesByRevision = this.groupBy(
      revisionCategories,
      (revisionCategory) => revisionCategory.revision_id
    )

    const attributeValues = await EstablishmentRevisionAttributeValue.query()
      .where('tenant_id', tenantId)
      .whereIn('revision_id', revisionIds)
      .select([
        'id',
        'tenant_id',
        'revision_id',
        'attribute_definition_id',
        'value_text',
        'value_boolean',
        'value_integer',
        'value_decimal',
        'value_url',
      ])
      .orderBy('revision_id', 'asc')
      .orderBy('id', 'asc')
    const attributeValueIds = attributeValues.map((value) => value.id)
    const selectedOptions =
      attributeValueIds.length > 0
        ? await EstablishmentRevisionAttributeValueOption.query()
            .where('tenant_id', tenantId)
            .whereIn('attribute_value_id', attributeValueIds)
            .select(['id', 'tenant_id', 'attribute_value_id', 'attribute_option_id'])
            .orderBy('attribute_value_id', 'asc')
            .orderBy('id', 'asc')
        : []
    const optionsByValue = this.groupBy(selectedOptions, (option) => option.attribute_value_id)
    for (const attributeValue of attributeValues) {
      attributeValue.$setRelated('selected_options', optionsByValue.get(attributeValue.id) ?? [])
    }
    const valuesByRevision = this.groupBy(attributeValues, (value) => value.revision_id)

    const mediaQuery = EstablishmentRevisionMedia.query()
      .where('tenant_id', tenantId)
      .whereIn('revision_id', revisionIds)
      .orderBy('revision_id', 'asc')
      .orderBy('is_cover', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    if (!includeEditorDetails) {
      mediaQuery.select(['id', 'tenant_id', 'revision_id', 'is_cover', 'moderation_status'])
    }
    const media = await mediaQuery

    if (includeEditorDetails && media.length > 0) {
      const assetIds = [...new Set(media.map((item) => item.media_asset_id))]
      const assets = await MediaAsset.query()
        .where('tenant_id', tenantId)
        .whereIn('id', assetIds)
        .orderBy('id', 'asc')
      const fileIds = [...new Set(assets.map((asset) => asset.file_id))]
      const files =
        fileIds.length > 0
          ? await StoredFile.query()
              .where('tenant_id', tenantId)
              .whereIn('id', fileIds)
              .orderBy('id', 'asc')
          : []
      const fileById = new Map(files.map((file) => [file.id, file]))
      const assetById = new Map(assets.map((asset) => [asset.id, asset]))
      for (const asset of assets) {
        asset.$setRelated('file', fileById.get(asset.file_id) ?? null)
      }
      for (const item of media) {
        item.$setRelated('asset', assetById.get(item.media_asset_id) ?? null)
      }
    }
    const mediaByRevision = this.groupBy(media, (item) => item.revision_id)

    for (const revision of revisions) {
      revision.$setRelated('address', addressByRevision.get(revision.id) ?? null)
      revision.$setRelated('hours', hoursByRevision.get(revision.id) ?? [])
      revision.$setRelated('categories', categoriesByRevision.get(revision.id) ?? [])
      revision.$setRelated('attribute_values', valuesByRevision.get(revision.id) ?? [])
      revision.$setRelated('media', mediaByRevision.get(revision.id) ?? [])
    }
  }

  private completenessRevisionColumns(): string[] {
    return [
      'id',
      'tenant_id',
      'establishment_id',
      'version',
      'status',
      'city_id',
      'public_name',
      'slug',
      'short_description',
      'description',
      'public_phone',
      'whatsapp',
      'public_email',
      'website',
      'instagram',
      'booking_url',
      'availability_type',
      'rules_version',
    ]
  }

  private groupBy<T>(items: readonly T[], keyFor: (item: T) => number): Map<number, T[]> {
    const grouped = new Map<number, T[]>()
    for (const item of items) {
      const key = keyFor(item)
      const group = grouped.get(key) ?? []
      group.push(item)
      grouped.set(key, group)
    }
    return grouped
  }
}

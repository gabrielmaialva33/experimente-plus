import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'

/**
 * One repository over the three kinds of partner content.
 *
 * They are separate tables because they carry different facts — an event has a
 * window, a showcase item has a price to display — but they are read, listed
 * and moderated identically, and the model is chosen by kind rather than by
 * three copies of the same query.
 */
const MODELS = {
  experience: EstablishmentExperience,
  event: EstablishmentEvent,
  showcase_item: EstablishmentShowcaseItem,
} as const

export default class PartnerContentRepository {
  model(kind: IPartnerContent.ContentKind) {
    return MODELS[kind]
  }

  async findById(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<IPartnerContent.ContentRow | null> {
    const query = this.model(kind).query({ client }).where('tenant_id', tenantId).where('id', id)

    if (lock) {
      query.forUpdate()
    }

    return query.first() as Promise<IPartnerContent.ContentRow | null>
  }

  /** The partner's own view: everything they own, whatever its status. */
  async paginateForEstablishments(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentIds: number[],
    query: IPartnerContent.ListQuery
  ) {
    const rows = this.model(kind)
      .query()
      .where('tenant_id', tenantId)
      .whereIn('establishment_id', establishmentIds)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.status !== undefined) rows.where('status', query.status)
    if (query.establishment_id !== undefined) {
      rows.where('establishment_id', query.establishment_id)
    }

    return rows.paginate(query.page ?? 1, query.per_page ?? 20)
  }

  /** The moderation queue: one operation, every establishment in it. */
  async paginateForTenant(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    query: IPartnerContent.ListQuery
  ) {
    const rows = this.model(kind)
      .query()
      .where('tenant_id', tenantId)
      .preload('establishment')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    if (query.status !== undefined) rows.where('status', query.status)
    if (query.establishment_id !== undefined) {
      rows.where('establishment_id', query.establishment_id)
    }

    return rows.paginate(query.page ?? 1, query.per_page ?? 20)
  }

  /**
   * Public reading.
   *
   * What the public sees is the approved snapshot, never the live columns. That
   * is the whole point of ADR-0028 §4: when a published item is edited and the
   * operation requires approval, the row moves to `pending_review` while the
   * previously approved version stays visible. Filtering by `status =
   * 'published'` would take a published event off the air because someone fixed
   * a comma in it.
   *
   * So the condition is "has an approved version and has not been withdrawn",
   * and for events the window comes from that same snapshot — an edit that has
   * not been approved cannot change when the public thinks the event happens.
   */
  async listPublished(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentId: number,
    now: Date
  ): Promise<IPartnerContent.ContentRow[]> {
    const rows = this.model(kind)
      .query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .whereNotNull('published_snapshot')
      .whereNot('status', 'archived')

    if (kind === 'event') {
      rows
        .whereRaw("(published_snapshot->>'ends_at')::timestamptz > ?", [now])
        .orderByRaw("(published_snapshot->>'starts_at')::timestamptz asc")
    } else {
      rows.orderBy('published_at', 'desc')
    }

    return rows as unknown as Promise<IPartnerContent.ContentRow[]>
  }
}

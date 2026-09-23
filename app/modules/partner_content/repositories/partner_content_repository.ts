import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import {
  discoverableEstablishmentExistsSql,
  discoverableEstablishmentsForCitySql,
} from '#modules/catalog/repositories/catalog_discoverability'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import type { CityDayWindow } from '#modules/partner_content/services/city_day_window'

/**
 * One row of a city agenda band, as PostgreSQL returns it.
 *
 * `starts_at`, `ends_at` and `published_at` arrive as whatever the driver made
 * of a `timestamptz`; the service normalizes them to a UTC instant. The
 * establishment identity is the slug pair, because that is what a public link
 * is built from.
 */
export interface CityAgendaRow {
  id: number | string
  establishment_slug: string
  establishment_name: string
  city_slug: string
  title: string | null
  description: string | null
  starts_at: string | Date | null
  ends_at: string | Date | null
  published_at: string | Date | null
}

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
      .preload('establishment', (establishmentQuery) => {
        establishmentQuery
          .preload('organization')
          .preload('published_revision', (revisionQuery) => revisionQuery.preload('city'))
      })
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
   *
   * The content's own state is not enough, though. It says nothing about the
   * establishment behind it, and a suspended unit, one whose published revision
   * was withdrawn, one under a deactivated organization or one that closed
   * permanently must not keep answering through this side door. That is the
   * revalidation ADR-0016 §3 requires, and it is applied as an `EXISTS` so the
   * guard costs no extra round trip.
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
      .whereRaw(`EXISTS (${discoverableEstablishmentExistsSql})`, [tenantId, establishmentId])

    if (kind === 'event') {
      rows
        .whereRaw("(published_snapshot->>'ends_at')::timestamptz > ?", [now])
        .orderByRaw("(published_snapshot->>'starts_at')::timestamptz asc")
    } else {
      rows.orderBy('published_at', 'desc')
    }

    return rows as unknown as Promise<IPartnerContent.ContentRow[]>
  }

  /**
   * Events that are on right now, in the city's local day.
   *
   * The predicate is `starts_at < tomorrow 00:00 local AND ends_at > now`, and
   * that is exactly "the event's window intersects today and it has not ended":
   * `now` is inside the local day by construction, so it already carries the
   * lower bound of the day and a redundant `ends_at > today 00:00` would only
   * hide that. A festival that began three days ago and ends tomorrow is
   * happening today, and this says so.
   */
  async listCityAgendaHappeningToday(
    tenantId: number,
    cityId: number,
    window: CityDayWindow,
    limit: number
  ): Promise<CityAgendaRow[]> {
    return this.runAgendaQuery(
      this.eventAgendaSql(
        `(content.published_snapshot->>'starts_at')::timestamptz < ?
         AND (content.published_snapshot->>'ends_at')::timestamptz > ?`
      ),
      [tenantId, cityId, tenantId, new Date(window.day_end), new Date(window.now), limit]
    )
  }

  /** Announced events: from tomorrow's local midnight to the local horizon. */
  async listCityAgendaUpcoming(
    tenantId: number,
    cityId: number,
    window: CityDayWindow,
    limit: number
  ): Promise<CityAgendaRow[]> {
    return this.runAgendaQuery(
      this.eventAgendaSql(
        `(content.published_snapshot->>'starts_at')::timestamptz >= ?
         AND (content.published_snapshot->>'starts_at')::timestamptz < ?`
      ),
      [tenantId, cityId, tenantId, new Date(window.day_end), new Date(window.horizon_end), limit]
    )
  }

  /**
   * The most recently published experiences of the city.
   *
   * Chronological, never ranked: the band is labelled "Novidades" because the
   * product has no prominence contract to honour. At least one approved image is
   * required because the band is a visual strip — a card with no cover would be
   * a worse answer than one card fewer.
   */
  async listCityAgendaNewExperiences(
    tenantId: number,
    cityId: number,
    limit: number
  ): Promise<CityAgendaRow[]> {
    const sql = `
      WITH discoverable AS (
        ${discoverableEstablishmentsForCitySql}
      )
      SELECT
        content.id,
        discoverable.establishment_slug,
        discoverable.public_name AS establishment_name,
        discoverable.city_slug,
        content.published_snapshot->>'title' AS title,
        content.published_snapshot->>'description' AS description,
        NULL::timestamptz AS starts_at,
        NULL::timestamptz AS ends_at,
        content.published_at
      FROM establishment_experiences content
      JOIN discoverable
        ON discoverable.establishment_id = content.establishment_id
       AND discoverable.tenant_id = content.tenant_id
      WHERE content.tenant_id = ?
        AND content.published_snapshot IS NOT NULL
        AND content.published_at IS NOT NULL
        AND content.status <> 'archived'
        AND EXISTS (
          SELECT 1
          FROM partner_content_media media
          WHERE media.tenant_id = content.tenant_id
            AND media.experience_id = content.id
            AND media.moderation_status = 'approved'
        )
      ORDER BY
        content.published_at DESC,
        discoverable.establishment_slug ASC,
        content.id ASC
      LIMIT ?
    `

    return this.runAgendaQuery(sql, [tenantId, cityId, tenantId, limit])
  }

  /**
   * One statement per band, never one per establishment.
   *
   * The discoverability revalidation is a CTE joined to the content, so the
   * establishment's slug, public name and city slug come back with the row and
   * no second query is needed to build the link.
   */
  private eventAgendaSql(windowPredicate: string): string {
    return `
      WITH discoverable AS (
        ${discoverableEstablishmentsForCitySql}
      )
      SELECT
        content.id,
        discoverable.establishment_slug,
        discoverable.public_name AS establishment_name,
        discoverable.city_slug,
        content.published_snapshot->>'title' AS title,
        content.published_snapshot->>'description' AS description,
        (content.published_snapshot->>'starts_at')::timestamptz AS starts_at,
        (content.published_snapshot->>'ends_at')::timestamptz AS ends_at,
        content.published_at
      FROM establishment_events content
      JOIN discoverable
        ON discoverable.establishment_id = content.establishment_id
       AND discoverable.tenant_id = content.tenant_id
      WHERE content.tenant_id = ?
        AND content.published_snapshot IS NOT NULL
        AND content.status <> 'archived'
        AND ${windowPredicate}
      ORDER BY
        (content.published_snapshot->>'starts_at')::timestamptz ASC,
        discoverable.establishment_slug ASC,
        content.id ASC
      LIMIT ?
    `
  }

  private async runAgendaQuery(
    sql: string,
    bindings: Array<number | Date>
  ): Promise<CityAgendaRow[]> {
    const result = await db.rawQuery<{ rows: CityAgendaRow[] }>(sql, bindings)
    return result.rows
  }
}

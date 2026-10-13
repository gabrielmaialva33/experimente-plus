import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import {
  cardOf,
  ESTABLISHMENT_CARD_COLUMNS,
  instant,
  type CardColumns,
} from '#modules/explorer/repositories/explorer_cards'

/**
 * The public rule of partner content, per species, as on a place's own page:
 * an approved snapshot with a title, not archived, and for an event a window
 * that has not ended. The `?` of the event branch is the current instant.
 */
const SPECIES_SQL = `
  SELECT 'experience'::text AS kind, content.id, content.tenant_id, content.establishment_id,
         content.published_snapshot, content.published_at
  FROM establishment_experiences content
  WHERE content.tenant_id = ?
    AND content.published_snapshot IS NOT NULL
    AND content.published_at IS NOT NULL
    AND content.status <> 'archived'
    AND coalesce(content.published_snapshot->>'title', '') <> ''

  UNION ALL

  SELECT 'event'::text, content.id, content.tenant_id, content.establishment_id,
         content.published_snapshot, content.published_at
  FROM establishment_events content
  WHERE content.tenant_id = ?
    AND content.published_snapshot IS NOT NULL
    AND content.published_at IS NOT NULL
    AND content.status <> 'archived'
    AND coalesce(content.published_snapshot->>'title', '') <> ''
    AND (content.published_snapshot->>'ends_at')::timestamptz > ?

  UNION ALL

  SELECT 'showcase_item'::text, content.id, content.tenant_id, content.establishment_id,
         content.published_snapshot, content.published_at
  FROM establishment_showcase_items content
  WHERE content.tenant_id = ?
    AND content.published_snapshot IS NOT NULL
    AND content.published_at IS NOT NULL
    AND content.status <> 'archived'
    AND coalesce(content.published_snapshot->>'title', '') <> ''
`

/**
 * The person's follows that are still public, and what those places published.
 * Bindings, in order: tenant (projection), tenant, user, tenant ×3 and now
 * (species).
 */
const UPDATES_SQL = `
  WITH followed AS (
    SELECT projection.*
    FROM explorer_follows follow
    JOIN (${discoverableEstablishmentsForTenantSql}) projection
      ON projection.establishment_id = follow.establishment_id
     AND projection.tenant_id = follow.tenant_id
    WHERE follow.tenant_id = ? AND follow.user_id = ?
  ),
  updates AS (${SPECIES_SQL})
`

interface UpdateRow extends CardColumns {
  kind: IExplorer.FollowingUpdateKind
  id: number | string
  title: string
  description: string | null
  published_at: unknown
  starts_at: string | null
  ends_at: string | null
  informational_price_cents: string | number | null
  cover_url: string | null
  cover_alt_text: string | null
}

/**
 * "Dos lugares que você segue" — what the followed establishments published.
 *
 * Follows are read for the caller only, and every place is revalidated against
 * the discoverable projection: a place that was withdrawn stops contributing
 * at once, without its follow being deleted. Chronological, most recent first;
 * there is no ranking to imply.
 */
export default class ExplorerFollowingRepository {
  async hasFollows(tenantId: number, userId: number): Promise<boolean> {
    const result = await db.rawQuery(
      `
      SELECT EXISTS (
        SELECT 1
        FROM explorer_follows follow
        JOIN (${discoverableEstablishmentsForTenantSql}) projection
          ON projection.establishment_id = follow.establishment_id
         AND projection.tenant_id = follow.tenant_id
        WHERE follow.tenant_id = ? AND follow.user_id = ?
      ) AS present
      `,
      [tenantId, tenantId, userId]
    )

    return result.rows[0]?.present === true
  }

  async countUpdates(tenantId: number, userId: number, now: Date): Promise<number> {
    const result = await db.rawQuery(
      `
      ${UPDATES_SQL}
      SELECT count(*)::integer AS total
      FROM updates
      JOIN followed projection
        ON projection.establishment_id = updates.establishment_id
       AND projection.tenant_id = updates.tenant_id
      `,
      this.bindings(tenantId, userId, now)
    )

    return Number(result.rows[0]?.total ?? 0)
  }

  async listUpdates(
    tenantId: number,
    userId: number,
    now: Date,
    page: number,
    perPage: number
  ): Promise<IExplorer.FollowingUpdate[]> {
    const result = await db.rawQuery(
      `
      ${UPDATES_SQL},
      listed AS (
        SELECT
          updates.kind,
          updates.id,
          updates.tenant_id,
          updates.published_at,
          updates.published_snapshot->>'title' AS title,
          updates.published_snapshot->>'description' AS description,
          CASE WHEN updates.kind = 'event'
            THEN updates.published_snapshot->>'starts_at' END AS starts_at,
          CASE WHEN updates.kind = 'event'
            THEN updates.published_snapshot->>'ends_at' END AS ends_at,
          CASE WHEN updates.kind = 'showcase_item'
            THEN updates.published_snapshot->>'informational_price_cents' END
            AS informational_price_cents,
          ${ESTABLISHMENT_CARD_COLUMNS}
        FROM updates
        JOIN followed projection
          ON projection.establishment_id = updates.establishment_id
         AND projection.tenant_id = updates.tenant_id
        ORDER BY updates.published_at DESC, updates.kind ASC, updates.id DESC
        LIMIT ? OFFSET ?
      )
      SELECT listed.*, cover.url AS cover_url, cover.alt_text AS cover_alt_text
      FROM listed
      LEFT JOIN LATERAL (
        SELECT stored_file.url, media.alt_text
          FROM partner_content_media media
          JOIN media_assets asset
            ON asset.id = media.media_asset_id
           AND asset.tenant_id = media.tenant_id
          JOIN files stored_file
            ON stored_file.id = asset.file_id
         WHERE media.tenant_id = listed.tenant_id
           AND media.moderation_status = 'approved'
           AND CASE listed.kind
             WHEN 'experience' THEN media.experience_id = listed.id
             WHEN 'event' THEN media.event_id = listed.id
             ELSE media.showcase_item_id = listed.id
           END
         ORDER BY media.is_cover DESC, media.sort_order ASC, media.id ASC
         LIMIT 1
      ) cover ON true
      ORDER BY listed.published_at DESC, listed.kind ASC, listed.id DESC
      `,
      [...this.bindings(tenantId, userId, now), perPage, (page - 1) * perPage]
    )

    return (result.rows as UpdateRow[]).map((row) => {
      const price = row.informational_price_cents
      const cents = price === null || price === undefined ? null : Number(price)
      return {
        kind: row.kind,
        id: Number(row.id),
        title: row.title,
        description: row.description?.trim() ? row.description : null,
        published_at: instant(row.published_at),
        starts_at: row.starts_at ? instant(row.starts_at) : null,
        ends_at: row.ends_at ? instant(row.ends_at) : null,
        informational_price_cents: cents !== null && Number.isFinite(cents) ? cents : null,
        cover:
          row.cover_url && row.cover_alt_text
            ? { url: row.cover_url, alt_text: row.cover_alt_text }
            : null,
        establishment: cardOf(row),
      }
    })
  }

  private bindings(tenantId: number, userId: number, now: Date) {
    return [tenantId, tenantId, userId, tenantId, tenantId, now, tenantId]
  }
}

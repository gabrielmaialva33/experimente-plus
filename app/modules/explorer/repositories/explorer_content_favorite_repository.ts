import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import {
  cardOf,
  ESTABLISHMENT_CARD_COLUMNS,
  instant,
  type CardColumns,
} from '#modules/explorer/repositories/explorer_cards'

const TABLE = 'explorer_content_favorites'

const SPECIES: Record<
  IExplorer.FavoriteContentKind,
  { column: 'experience_id' | 'event_id'; content: string; media: string }
> = {
  experience: {
    column: 'experience_id',
    content: 'establishment_experiences',
    media: 'experience_id',
  },
  event: { column: 'event_id', content: 'establishment_events', media: 'event_id' },
}

/**
 * The public-visibility rule for one favourited item, as a SQL predicate over
 * `content` and a joined discoverable `projection`.
 *
 * It is the rule the public listing of ADR-0028 applies: an approved snapshot,
 * not withdrawn, on an establishment the catalogue still shows, and for an
 * event a window that has not ended. An ended event is not deleted from the
 * favourites — the row was the person's — but it stops being navigable and is
 * counted as unavailable, exactly like a withdrawn place.
 */
const visible = (kind: IExplorer.FavoriteContentKind) => `
  content.published_snapshot IS NOT NULL
  AND content.status <> 'archived'
  AND coalesce(content.published_snapshot->>'title', '') <> ''
  ${kind === 'event' ? `AND (content.published_snapshot->>'ends_at')::timestamptz > ?` : ''}
`

/**
 * Favourited partner content — ADR-0030 (revision of 23/09/2026).
 */
export default class ExplorerContentFavoriteRepository {
  async list(tenantId: number, userId: number, now: Date): Promise<IExplorer.SavedContentList> {
    const parts: IExplorer.SavedContent[] = []

    for (const kind of Object.keys(SPECIES) as IExplorer.FavoriteContentKind[]) {
      const species = SPECIES[kind]
      const result = await db.rawQuery(
        `
        SELECT
          saved.id AS saved_id,
          saved.created_at AS saved_at,
          content.id AS content_id,
          content.published_snapshot->>'title' AS title,
          content.published_snapshot->>'starts_at' AS starts_at,
          content.published_snapshot->>'ends_at' AS ends_at,
          cover.url AS content_cover_url,
          ${ESTABLISHMENT_CARD_COLUMNS}
        FROM ${TABLE} saved
        JOIN ${species.content} content
          ON content.id = saved.${species.column}
         AND content.tenant_id = saved.tenant_id
        JOIN (${discoverableEstablishmentsForTenantSql}) projection
          ON projection.establishment_id = content.establishment_id
         AND projection.tenant_id = content.tenant_id
        LEFT JOIN LATERAL (
          SELECT stored_file.url
            FROM partner_content_media media
            JOIN media_assets asset
              ON asset.id = media.media_asset_id
             AND asset.tenant_id = media.tenant_id
            JOIN files stored_file
              ON stored_file.id = asset.file_id
           WHERE media.tenant_id = content.tenant_id
             AND media.${species.media} = content.id
             AND media.moderation_status = 'approved'
           ORDER BY media.is_cover DESC, media.sort_order ASC, media.id ASC
           LIMIT 1
        ) cover ON true
        WHERE saved.tenant_id = ?
          AND saved.user_id = ?
          AND ${visible(kind)}
        `,
        [tenantId, tenantId, userId, ...(kind === 'event' ? [now] : [])]
      )

      for (const row of result.rows as Array<
        CardColumns & {
          saved_id: number
          saved_at: unknown
          content_id: number
          title: string
          starts_at: string | null
          ends_at: string | null
          content_cover_url: string | null
        }
      >) {
        parts.push({
          id: Number(row.saved_id),
          content: {
            kind,
            id: Number(row.content_id),
            title: row.title,
            starts_at: row.starts_at ? instant(row.starts_at) : null,
            ends_at: row.ends_at ? instant(row.ends_at) : null,
            cover_url: row.content_cover_url ?? null,
            establishment: cardOf(row),
          },
          created_at: instant(row.saved_at),
        })
      }
    }

    parts.sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id
    )

    const total = await db
      .from(TABLE)
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .count('* as total')

    return {
      data: parts,
      unavailable: Math.max(0, Number(total[0]?.total ?? 0) - parts.length),
    }
  }

  /** Whether the item can be saved now: the same rule the list reads. */
  async isVisible(
    tenantId: number,
    kind: IExplorer.FavoriteContentKind,
    contentId: number,
    now: Date
  ): Promise<boolean> {
    const species = SPECIES[kind]
    const result = await db.rawQuery(
      `
      SELECT EXISTS (
        SELECT 1
          FROM ${species.content} content
          JOIN (${discoverableEstablishmentsForTenantSql}) projection
            ON projection.establishment_id = content.establishment_id
           AND projection.tenant_id = content.tenant_id
         WHERE content.tenant_id = ?
           AND content.id = ?
           AND ${visible(kind)}
      ) AS present
      `,
      [tenantId, tenantId, contentId, ...(kind === 'event' ? [now] : [])]
    )

    return result.rows[0]?.present === true
  }

  async isSaved(
    tenantId: number,
    userId: number,
    kind: IExplorer.FavoriteContentKind,
    contentId: number
  ): Promise<boolean> {
    const row = await db
      .from(TABLE)
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where(SPECIES[kind].column, contentId)
      .first()
    return Boolean(row)
  }

  /** Idempotent: the conflict target is the species' own uniqueness. */
  async save(
    tenantId: number,
    userId: number,
    kind: IExplorer.FavoriteContentKind,
    contentId: number
  ): Promise<void> {
    const column = SPECIES[kind].column
    await db.rawQuery(
      `
      INSERT INTO ${TABLE} (tenant_id, user_id, ${column}, created_at, updated_at)
      VALUES (?, ?, ?, now(), now())
      ON CONFLICT (tenant_id, user_id, ${column}) DO NOTHING
      `,
      [tenantId, userId, contentId]
    )
  }

  async remove(
    tenantId: number,
    userId: number,
    kind: IExplorer.FavoriteContentKind,
    contentId: number
  ): Promise<void> {
    await db
      .from(TABLE)
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where(SPECIES[kind].column, contentId)
      .delete()
  }

  async purgeForUser(userId: number, client: any): Promise<void> {
    await client.from(TABLE).where('user_id', userId).delete()
  }
}

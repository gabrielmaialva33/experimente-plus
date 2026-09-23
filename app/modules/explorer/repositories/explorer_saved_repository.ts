import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import {
  cardOf,
  ESTABLISHMENT_CARD_COLUMNS,
  instant,
  type CardColumns,
} from '#modules/explorer/repositories/explorer_cards'

export type SavedKind = 'favorite' | 'follow'

const TABLE: Record<SavedKind, string> = {
  favorite: 'explorer_favorites',
  follow: 'explorer_follows',
}

/**
 * Favourites and follows — ADR-0030.
 *
 * They are separate tables because they mean different things, and that
 * decision lives in the schema where it has consequences. The *query* over them
 * is genuinely the same shape, so it is written once here: duplicating a join
 * would not make the distinction any more real, it would only make a fix land
 * in one of two places.
 */
export default class ExplorerSavedRepository {
  async list(kind: SavedKind, tenantId: number, userId: number): Promise<IExplorer.SavedList> {
    const table = TABLE[kind]

    const rows = await db.rawQuery(
      `
      SELECT saved.id AS saved_id, saved.created_at AS saved_at, ${ESTABLISHMENT_CARD_COLUMNS}
      FROM ${table} saved
      JOIN (${discoverableEstablishmentsForTenantSql}) projection
        ON projection.establishment_id = saved.establishment_id
       AND projection.tenant_id = saved.tenant_id
      WHERE saved.tenant_id = ? AND saved.user_id = ?
      ORDER BY saved.created_at DESC, saved.id DESC
      `,
      [tenantId, tenantId, userId]
    )

    const total = await db
      .from(table)
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .count('* as total')

    const visible = rows.rows as Array<CardColumns & { saved_id: number; saved_at: unknown }>
    const stored = Number(total[0]?.total ?? 0)

    return {
      data: visible.map((row) => ({
        id: Number(row.saved_id),
        establishment: cardOf(row),
        created_at: instant(row.saved_at),
      })),
      unavailable: Math.max(0, stored - visible.length),
    }
  }

  /**
   * Saving twice is the same intent, so the second call is not an error.
   *
   * The conflict target is the uniqueness the schema already declares, which
   * means two concurrent taps race in the database rather than in a read that
   * checks and a write that assumes.
   */
  async save(
    kind: SavedKind,
    tenantId: number,
    userId: number,
    establishmentId: number
  ): Promise<void> {
    await db.rawQuery(
      `
      INSERT INTO ${TABLE[kind]} (tenant_id, user_id, establishment_id, created_at, updated_at)
      VALUES (?, ?, ?, now(), now())
      ON CONFLICT (tenant_id, user_id, establishment_id) DO NOTHING
      `,
      [tenantId, userId, establishmentId]
    )
  }

  async remove(
    kind: SavedKind,
    tenantId: number,
    userId: number,
    establishmentId: number
  ): Promise<void> {
    await db
      .from(TABLE[kind])
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where('establishment_id', establishmentId)
      .delete()
  }

  /** What the establishment page needs to render its own two buttons. */
  async statusFor(
    tenantId: number,
    userId: number,
    establishmentId: number
  ): Promise<{ favorited: boolean; following: boolean }> {
    const [favorite, follow] = await Promise.all([
      db
        .from(TABLE.favorite)
        .where('tenant_id', tenantId)
        .where('user_id', userId)
        .where('establishment_id', establishmentId)
        .first(),
      db
        .from(TABLE.follow)
        .where('tenant_id', tenantId)
        .where('user_id', userId)
        .where('establishment_id', establishmentId)
        .first(),
    ])

    return { favorited: Boolean(favorite), following: Boolean(follow) }
  }

  /**
   * Erases this layer for a person, in every operation.
   *
   * Used by account deletion, which removes the person everywhere at once and
   * keeps only a tombstone on the user row. A preference is not something that
   * needs a tombstone.
   */
  async purgeForUser(userId: number, client: any): Promise<void> {
    for (const table of Object.values(TABLE)) {
      await client.from(table).where('user_id', userId).delete()
    }
  }
}

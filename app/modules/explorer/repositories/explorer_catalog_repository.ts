import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentExistsSql } from '#modules/catalog/repositories/catalog_discoverability'

/**
 * Whether the Explorer is allowed to point at an establishment at all.
 *
 * Writes check it as well as reads. Without this, the save endpoints would
 * answer differently for an establishment that exists but was withheld and one
 * that never existed, which turns a bookmark button into a way of asking the
 * server what it is hiding.
 */
export default class ExplorerCatalogRepository {
  async isDiscoverable(tenantId: number, establishmentId: number): Promise<boolean> {
    const result = await db.rawQuery(
      `SELECT EXISTS (${discoverableEstablishmentExistsSql}) AS present`,
      [tenantId, establishmentId]
    )

    return result.rows[0]?.present === true
  }
}

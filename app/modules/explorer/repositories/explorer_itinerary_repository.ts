import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import ExplorerItinerary from '#modules/explorer/models/explorer_itinerary'
import {
  cardOf,
  ESTABLISHMENT_CARD_COLUMNS,
  instant,
  type CardColumns,
} from '#modules/explorer/repositories/explorer_cards'

/**
 * Itineraries and their stops — ADR-0030.
 *
 * Every read is scoped by owner as well as tenant. An itinerary of another
 * person is not forbidden, it is absent: answering "forbidden" would confirm
 * that a given identifier exists, which is a fact this layer has no reason to
 * hand out.
 */
export default class ExplorerItineraryRepository {
  async list(tenantId: number, userId: number): Promise<IExplorer.ItinerarySummary[]> {
    const rows = await db
      .from('explorer_itineraries as itinerary')
      .leftJoin('explorer_itinerary_items as stop', (join) => {
        join.on('stop.itinerary_id', 'itinerary.id').andOn('stop.tenant_id', 'itinerary.tenant_id')
      })
      .where('itinerary.tenant_id', tenantId)
      .where('itinerary.user_id', userId)
      .groupBy('itinerary.id')
      .orderBy('itinerary.updated_at', 'desc')
      .select(
        'itinerary.id',
        'itinerary.name',
        'itinerary.notes',
        'itinerary.created_at',
        'itinerary.updated_at'
      )
      .count('stop.id as stops_count')

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      notes: row.notes ?? null,
      stops_count: Number(row.stops_count ?? 0),
      created_at: instant(row.created_at),
      updated_at: instant(row.updated_at),
    }))
  }

  async findOwned(
    tenantId: number,
    userId: number,
    itineraryId: number
  ): Promise<ExplorerItinerary | null> {
    return ExplorerItinerary.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where('id', itineraryId)
      .first()
  }

  async show(
    tenantId: number,
    userId: number,
    itineraryId: number
  ): Promise<IExplorer.ItineraryProjection | null> {
    const itinerary = await this.findOwned(tenantId, userId, itineraryId)
    if (!itinerary) return null

    // Left join: a stop whose establishment left the catalogue keeps its place
    // and its note, and arrives without a card. Dropping it would rewrite a
    // route its author wrote.
    const rows = await db.rawQuery(
      `
      SELECT stop.id AS stop_id, stop.position, stop.note, ${ESTABLISHMENT_CARD_COLUMNS}
      FROM explorer_itinerary_items stop
      LEFT JOIN (${discoverableEstablishmentsForTenantSql}) projection
        ON projection.establishment_id = stop.establishment_id
       AND projection.tenant_id = stop.tenant_id
      WHERE stop.tenant_id = ? AND stop.itinerary_id = ?
      ORDER BY stop.position ASC, stop.id ASC
      `,
      [tenantId, tenantId, itineraryId]
    )

    const stops = rows.rows as Array<
      Partial<CardColumns> & { stop_id: number; position: number; note: string | null }
    >

    return {
      id: itinerary.id,
      name: itinerary.name,
      notes: itinerary.notes,
      stops: stops.map((row) => ({
        id: Number(row.stop_id),
        position: Number(row.position),
        note: row.note ?? null,
        establishment: row.card_id ? cardOf(row as CardColumns) : null,
      })),
      created_at: instant(itinerary.created_at?.toISO?.() ?? itinerary.created_at),
      updated_at: instant(itinerary.updated_at?.toISO?.() ?? itinerary.updated_at),
    }
  }

  /** The next free position, so a new stop lands at the end of the route. */
  async nextPosition(tenantId: number, itineraryId: number): Promise<number> {
    const row = await db
      .from('explorer_itinerary_items')
      .where('tenant_id', tenantId)
      .where('itinerary_id', itineraryId)
      .max('position as highest')
      .first()

    const highest = row?.highest
    return highest === null || highest === undefined ? 0 : Number(highest) + 1
  }

  async stopExists(tenantId: number, itineraryId: number, stopId: number): Promise<boolean> {
    const row = await db
      .from('explorer_itinerary_items')
      .where('tenant_id', tenantId)
      .where('itinerary_id', itineraryId)
      .where('id', stopId)
      .first()

    return Boolean(row)
  }

  async ownedStopIds(tenantId: number, itineraryId: number): Promise<number[]> {
    const rows = await db
      .from('explorer_itinerary_items')
      .where('tenant_id', tenantId)
      .where('itinerary_id', itineraryId)
      .orderBy('position', 'asc')
      .select('id')

    return rows.map((row) => Number(row.id))
  }

  /** Writes the order the person chose, as one transaction. */
  async applyOrder(tenantId: number, itineraryId: number, stopIds: number[]): Promise<void> {
    await db.transaction(async (client) => {
      for (const [index, stopId] of stopIds.entries()) {
        await client
          .from('explorer_itinerary_items')
          .where('tenant_id', tenantId)
          .where('itinerary_id', itineraryId)
          .where('id', stopId)
          .update({ position: index, updated_at: new Date() })
      }
    })
  }

  async purgeForUser(userId: number, client: any): Promise<void> {
    // Stops go with their itinerary through the schema's own cascade.
    await client.from('explorer_itineraries').where('user_id', userId).delete()
  }
}

import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

import ExplorerItineraryItem from '#modules/explorer/models/explorer_itinerary_item'

/**
 * An itinerary the Explorer saved — ADR-0030.
 *
 * Private to its author: there is no public route, no itinerary of another
 * user and no listing by establishment.
 */
export default class ExplorerItinerary extends BaseModel {
  static table = 'explorer_itineraries'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare user_id: number

  @column()
  declare name: string

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @hasMany(() => ExplorerItineraryItem, { foreignKey: 'itinerary_id' })
  declare items: HasMany<typeof ExplorerItineraryItem>
}

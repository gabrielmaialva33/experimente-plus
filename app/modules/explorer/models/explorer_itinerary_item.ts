import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'

/**
 * One stop of an itinerary — ADR-0030.
 *
 * The same establishment may appear more than once: lunch and coming back at
 * night are two stops, not a duplicate.
 */
export default class ExplorerItineraryItem extends BaseModel {
  static table = 'explorer_itinerary_items'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare itinerary_id: number

  @column()
  declare establishment_id: number

  @column()
  declare position: number

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>
}

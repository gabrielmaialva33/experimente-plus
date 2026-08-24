import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IMedia from '#modules/media/interfaces/media_interface'
import User from '#modules/users/models/user'

export default class MediaModerationEvent extends BaseModel {
  static table = 'media_moderation_events'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare revision_id: number

  @column()
  declare media_asset_id: number

  @column()
  declare revision_media_id: number

  @column()
  declare from_status: IMedia.ModerationStatus | null

  @column()
  declare to_status: IMedia.EventStatus

  @column()
  declare actor_id: number

  @column()
  declare reason: string | null

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @belongsTo(() => User, { foreignKey: 'actor_id' })
  declare actor: BelongsTo<typeof User>
}

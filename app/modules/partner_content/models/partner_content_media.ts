import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IMedia from '#modules/media/interfaces/media_interface'
import MediaAsset from '#modules/media/models/media_asset'
import User from '#modules/users/models/user'

export default class PartnerContentMedia extends BaseModel {
  static table = 'partner_content_media'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare experience_id: number | null

  @column()
  declare event_id: number | null

  @column()
  declare showcase_item_id: number | null

  @column()
  declare media_asset_id: number

  @column()
  declare is_cover: boolean

  @column()
  declare sort_order: number

  @column()
  declare alt_text: string

  @column()
  declare caption: string | null

  @column()
  declare moderation_status: IMedia.ModerationStatus

  @column()
  declare created_by: number | null

  @column()
  declare reviewed_by: number | null

  @column.dateTime()
  declare reviewed_at: DateTime | null

  @column()
  declare review_notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => MediaAsset, { foreignKey: 'media_asset_id' })
  declare asset: BelongsTo<typeof MediaAsset>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reviewed_by' })
  declare reviewer: BelongsTo<typeof User>
}

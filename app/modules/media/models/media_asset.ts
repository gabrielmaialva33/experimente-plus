import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'
import StoredFile from '#modules/files/models/file'
import type IMedia from '#modules/media/interfaces/media_interface'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import User from '#modules/users/models/user'

export default class MediaAsset extends BaseModel {
  static table = 'media_assets'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare file_id: number

  @column()
  declare media_type: IMedia.Type

  @column()
  declare file_extension: IMedia.ImageExtension

  @column()
  declare mime_type: IMedia.ImageMimeType

  @column({ columnName: 'checksum_sha256' })
  declare checksum_sha256: string

  @column()
  declare width: number

  @column()
  declare height: number

  @column()
  declare created_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => StoredFile, { foreignKey: 'file_id' })
  declare file: BelongsTo<typeof StoredFile>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => EstablishmentRevisionMedia, { foreignKey: 'media_asset_id' })
  declare revision_media: HasMany<typeof EstablishmentRevisionMedia>
}

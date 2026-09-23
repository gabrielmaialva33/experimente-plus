import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import MediaAsset from '#modules/media/models/media_asset'
import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * A photo attached to a review — ADR-0027.
 *
 * Serialisation is overridden rather than configured column by column. The
 * photo is always read with its asset and file preloaded, and Lucid serialises
 * preloaded relations whole: the storage key, the checksum, the owner and the
 * internal identifiers would all travel to a public, cacheable response. The
 * projection below is the entire public shape, so a column added to
 * `media_assets` or `files` later cannot leak through here by default.
 */
export default class EstablishmentReviewPhoto extends BaseModel {
  static table = 'establishment_review_photos'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare tenant_id: number

  @column({ serializeAs: null })
  declare establishment_id: number

  @column({ serializeAs: null })
  declare review_id: number

  @column({ serializeAs: null })
  declare media_asset_id: number

  @column({ serializeAs: null })
  declare sort_order: number

  @column()
  declare alt_text: string | null

  @column.dateTime({ autoCreate: true, serializeAs: null })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  declare updated_at: DateTime

  @belongsTo(() => MediaAsset, { foreignKey: 'media_asset_id' })
  declare asset: BelongsTo<typeof MediaAsset>

  projection(): IReview.ReviewPhotoProjection {
    return {
      id: this.id,
      url: this.asset?.file?.url ?? null,
      width: this.asset?.width ?? null,
      height: this.asset?.height ?? null,
      alt_text: this.alt_text,
    }
  }

  serialize() {
    return { ...this.projection() }
  }
}

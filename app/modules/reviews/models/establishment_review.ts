import { DateTime } from 'luxon'
import {
  BaseModel,
  belongsTo,
  column,
  hasMany,
  hasOne,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'

import BenefitRedemption from '#modules/benefits/models/benefit_redemption'
import Establishment from '#modules/establishments/models/establishment'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReviewPhoto from '#modules/reviews/models/establishment_review_photo'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class EstablishmentReview extends BaseModel {
  static table = 'establishment_reviews'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare user_id: number

  @column()
  declare redemption_id: number | null

  @column()
  declare rating: number

  @column()
  declare comment: string | null

  @column()
  declare status: IReview.ReviewStatus

  @column()
  declare photos_count: number

  @column()
  declare videos_count: number

  @column.dateTime()
  declare edited_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare author: BelongsTo<typeof User>

  @belongsTo(() => BenefitRedemption, { foreignKey: 'redemption_id' })
  declare redemption: BelongsTo<typeof BenefitRedemption>

  @hasOne(() => EstablishmentReviewReply, { foreignKey: 'review_id' })
  declare reply: HasOne<typeof EstablishmentReviewReply>

  /** Public exactly when the review is: photos carry no moderation state of their own. */
  @hasMany(() => EstablishmentReviewPhoto, { foreignKey: 'review_id' })
  declare photos: HasMany<typeof EstablishmentReviewPhoto>
}

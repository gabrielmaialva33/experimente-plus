import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'
import Organization from '#modules/organizations/models/organization'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class EstablishmentReviewReply extends BaseModel {
  static table = 'establishment_review_replies'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare review_id: number

  @column()
  declare organization_id: number

  @column()
  declare user_id: number

  @column()
  declare comment: string

  @column()
  declare status: IReview.ReplyStatus

  @column.dateTime()
  declare edited_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentReview, { foreignKey: 'review_id' })
  declare review: BelongsTo<typeof EstablishmentReview>

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare author: BelongsTo<typeof User>
}

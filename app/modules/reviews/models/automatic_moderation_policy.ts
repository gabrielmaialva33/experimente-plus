import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IReview from '#modules/reviews/interfaces/review_interface'
import Tenant from '#modules/tenants/models/tenant'

/** Automatic moderation rules of one operation — ADR-0031. */
export default class AutomaticModerationPolicy extends BaseModel {
  static table = 'automatic_moderation_policies'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare link_mode: IReview.AutomaticMode

  @column()
  declare contact_mode: IReview.AutomaticMode

  @column()
  declare payment_data_mode: IReview.AutomaticMode

  @column()
  declare blocked_term_mode: IReview.AutomaticMode

  // Stringified on the way in: the driver would otherwise send a JavaScript
  // array as a PostgreSQL array literal, which a jsonb column refuses.
  @column({
    prepare: (value: string[]) => JSON.stringify(value ?? []),
    consume: (value: unknown) =>
      Array.isArray(value) ? value : typeof value === 'string' ? JSON.parse(value) : [],
  })
  declare blocked_terms: string[]

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>
}

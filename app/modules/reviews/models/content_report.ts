import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IReview from '#modules/reviews/interfaces/review_interface'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class ContentReport extends BaseModel {
  static table = 'content_reports'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare target_type: IReview.ReportTargetType

  @column()
  declare target_id: number

  @column()
  declare reporter_id: number | null

  @column()
  declare reason: IReview.ReportReason

  @column()
  declare details: string | null

  @column()
  declare status: IReview.ReportStatus

  @column()
  declare resolved_by: number | null

  @column.dateTime()
  declare resolved_at: DateTime | null

  @column()
  declare resolution_action: string | null

  @column()
  declare resolution_notes: string | null

  @column()
  declare protocol_number: string

  @column()
  declare is_anonymous: boolean

  /** Hashes only: the report recognises repetition, never the person. */
  @column({ serializeAs: null })
  declare reporter_ip_hash: string | null

  @column({ serializeAs: null })
  declare reporter_token_hash: string | null

  @column()
  declare assigned_to: number | null

  @column.dateTime()
  declare due_at: DateTime | null

  @column.dateTime()
  declare sla_notified_at: DateTime | null

  /** `automatic` when a rule opened it (ADR-0031); such a report has no reporter. */
  @column()
  declare origin: IReview.ReportOrigin

  @column()
  declare automatic_rule: IReview.AutomaticRule | null

  /** Masked by the writer: a rule never copies a card number or an e-mail here. */
  @column()
  declare automatic_evidence: string | null

  /** The rule kept the content out of public view until a person decides. */
  @column()
  declare holds_content: boolean

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, { foreignKey: 'reporter_id' })
  declare reporter: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'resolved_by' })
  declare resolver: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'assigned_to' })
  declare assignee: BelongsTo<typeof User>
}

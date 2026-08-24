import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import User from '#modules/users/models/user'

export default class OrganizationClaim extends BaseModel {
  static table = 'organization_claims'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare organization_id: number

  @column()
  declare claimant_id: number

  @column()
  declare status: IOrganization.ClaimStatus

  @column()
  declare message: string | null

  @column()
  declare evidence: IOrganization.ClaimEvidence | null

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

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'claimant_id' })
  declare claimant: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reviewed_by' })
  declare reviewer: BelongsTo<typeof User>
}

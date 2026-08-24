import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import User from '#modules/users/models/user'

export default class OrganizationMember extends BaseModel {
  static table = 'organization_members'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare organization_id: number

  @column()
  declare user_id: number

  @column()
  declare role: IOrganization.Role

  @column()
  declare status: IOrganization.MemberStatus

  @column()
  declare invited_by: number | null

  @column.dateTime()
  declare joined_at: DateTime

  @column.dateTime()
  declare suspended_at: DateTime | null

  @column.dateTime()
  declare removed_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'invited_by' })
  declare inviter: BelongsTo<typeof User>
}

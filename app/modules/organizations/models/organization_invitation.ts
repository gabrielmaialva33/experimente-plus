import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import User from '#modules/users/models/user'

export default class OrganizationInvitation extends BaseModel {
  static table = 'organization_invitations'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare organization_id: number

  @column()
  declare email: string

  @column()
  declare role: IOrganization.Role

  @column({ serializeAs: null })
  declare token_hash: string

  @column()
  declare invited_by: number

  @column.dateTime()
  declare expires_at: DateTime

  @column()
  declare accepted_by: number | null

  @column.dateTime()
  declare accepted_at: DateTime | null

  @column()
  declare revoked_by: number | null

  @column.dateTime()
  declare revoked_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'invited_by' })
  declare inviter: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'accepted_by' })
  declare accepted_by_user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'revoked_by' })
  declare revoked_by_user: BelongsTo<typeof User>
}

import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationClaim from '#modules/organizations/models/organization_claim'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'

export default class Organization extends BaseModel {
  static table = 'organizations'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare legal_name: string

  @column()
  declare trade_name: string

  @column()
  declare slug: string

  @column()
  declare tax_id: string

  @column()
  declare email: string

  @column()
  declare phone: string

  @column()
  declare website: string | null

  @column()
  declare status: IOrganization.Status

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare submitted_at: DateTime | null

  @column()
  declare reviewed_by: number | null

  @column.dateTime()
  declare reviewed_at: DateTime | null

  @column()
  declare review_notes: string | null

  @column.dateTime()
  declare suspended_at: DateTime | null

  @column.dateTime()
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reviewed_by' })
  declare reviewer: BelongsTo<typeof User>

  @hasMany(() => OrganizationMember, { foreignKey: 'organization_id' })
  declare members: HasMany<typeof OrganizationMember>

  @hasMany(() => OrganizationInvitation, { foreignKey: 'organization_id' })
  declare invitations: HasMany<typeof OrganizationInvitation>

  @hasMany(() => OrganizationClaim, { foreignKey: 'organization_id' })
  declare claims: HasMany<typeof OrganizationClaim>
}

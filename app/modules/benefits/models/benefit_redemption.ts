import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

export default class BenefitRedemption extends BaseModel {
  static table = 'benefit_redemptions'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare access_id: number

  @column()
  declare edition_id: number

  @column()
  declare offer_id: number

  @column()
  declare establishment_id: number

  @column()
  declare organization_id: number

  @column()
  declare user_id: number

  @column()
  declare redeemed_by: number

  @column()
  declare redemption_number: number

  @column()
  declare presentation_nonce_hash: string

  @column()
  declare receipt_code: string

  @column()
  declare edition_name_snapshot: string

  @column()
  declare offer_title_snapshot: string

  @column()
  declare benefit_type_snapshot: string

  @column()
  declare offer_terms_snapshot: string | null

  @column()
  declare establishment_name_snapshot: string

  @column()
  declare holder_name_snapshot: string

  @column()
  declare holder_email_snapshot: string

  @column.dateTime()
  declare redeemed_at: DateTime

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime
}

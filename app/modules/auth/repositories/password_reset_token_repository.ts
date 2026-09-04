import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import PasswordResetToken from '#modules/auth/models/password_reset_token'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class PasswordResetTokenRepository extends LucidRepository<
  typeof PasswordResetToken
> {
  constructor() {
    super(PasswordResetToken)
  }

  async findOwnerByHash(tokenHash: string): Promise<number | null> {
    const token = await this.model.query().where('token_hash', tokenHash).select('user_id').first()

    return token?.user_id ?? null
  }

  async findByHashAndUserForUpdate(
    tokenHash: string,
    userId: number,
    client: TransactionClientContract
  ): Promise<PasswordResetToken | null> {
    return this.model
      .query({ client })
      .where('token_hash', tokenHash)
      .where('user_id', userId)
      .forUpdate()
      .first()
  }

  async consumeActiveForUser(
    userId: number,
    client: TransactionClientContract,
    consumedAt: DateTime = DateTime.now()
  ): Promise<void> {
    await this.model
      .query({ client })
      .where('user_id', userId)
      .whereNull('consumed_at')
      .update({ consumed_at: consumedAt })
  }
}

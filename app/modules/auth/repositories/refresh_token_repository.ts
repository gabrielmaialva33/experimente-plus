import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import RefreshToken from '#modules/auth/models/refresh_token'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class RefreshTokenRepository extends LucidRepository<typeof RefreshToken> {
  constructor() {
    super(RefreshToken)
  }

  async findOwnerByHash(tokenHash: string): Promise<number | null> {
    const token = await this.model.query().where('token_hash', tokenHash).select('user_id').first()

    return token?.user_id ?? null
  }

  async findByHashAndUserForUpdate(
    tokenHash: string,
    userId: number,
    client: TransactionClientContract
  ): Promise<RefreshToken | null> {
    return this.model
      .query({ client })
      .where('token_hash', tokenHash)
      .where('user_id', userId)
      .forUpdate()
      .first()
  }

  async revokeChainFrom(
    tokenId: number,
    userId: number,
    client: TransactionClientContract,
    revokedAt: DateTime = DateTime.now()
  ): Promise<void> {
    await client.rawQuery(
      `
        WITH RECURSIVE refresh_chain AS (
          SELECT id
          FROM auth_refresh_tokens
          WHERE id = ? AND user_id = ?

          UNION

          SELECT child.id
          FROM auth_refresh_tokens AS child
          INNER JOIN refresh_chain AS parent ON child.rotated_from_id = parent.id
          WHERE child.user_id = ?
        )
        UPDATE auth_refresh_tokens
        SET revoked_at = ?
        WHERE user_id = ?
          AND id IN (SELECT id FROM refresh_chain)
          AND revoked_at IS NULL
      `,
      [tokenId, userId, userId, revokedAt.toJSDate(), userId]
    )
  }

  async revokeAllForUser(
    userId: number,
    client: TransactionClientContract,
    revokedAt: DateTime = DateTime.now()
  ): Promise<void> {
    await this.model
      .query({ client })
      .where('user_id', userId)
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAt })
  }
}

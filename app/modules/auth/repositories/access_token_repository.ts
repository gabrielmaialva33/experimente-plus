import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/** Opaque access tokens issued through `User.accessTokens` (`auth_access_tokens`). */
export default class AccessTokenRepository {
  async deleteAllForUser(userId: number, client: TransactionClientContract): Promise<void> {
    await client.from('auth_access_tokens').where('tokenable_id', userId).delete()
  }
}

import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsRetentionRepository from '#modules/analytics/repositories/analytics_retention_repository'

/** The stored form of an anonymous session: a full HMAC-SHA256 in lowercase hex. */
const ANONYMOUS_SESSION_HASH = /^[0-9a-f]{64}$/

/**
 * Normalizes operator input into distinct full session hashes. Anything shorter
 * or longer than a full hash is refused, so a typo or a prefix can never select
 * sessions nobody named.
 */
export function parseAnonymousSessionHashes(values: readonly string[]): string[] {
  if (values.length === 0) {
    throw new BadRequestException('Name at least one anonymous session hash')
  }

  const hashes = new Set<string>()
  values.forEach((value, index) => {
    const hash = value.trim().toLowerCase()
    if (!ANONYMOUS_SESSION_HASH.test(hash)) {
      throw new BadRequestException(
        `Session #${index + 1} is not a full 64-character hexadecimal hash; prefixes are refused`
      )
    }
    hashes.add(hash)
  })

  return [...hashes]
}

@inject()
export default class AnalyticsRetentionService {
  constructor(private repository: AnalyticsRetentionRepository) {}

  async prune(): Promise<IAnalytics.RetentionResult> {
    return db.transaction((client) => this.repository.prune(client))
  }

  /**
   * Discards the analytics of explicit anonymous sessions, such as a crawler's
   * recorded before the filter existed. A dry run performs the very same work
   * in a transaction it then rolls back, so its counts are exactly what an
   * applied run would change; only `apply` commits.
   */
  async discardSessions(
    values: readonly string[],
    options: { apply: boolean }
  ): Promise<IAnalytics.SessionDiscardResult> {
    const sessionHashes = parseAnonymousSessionHashes(values)
    const transaction = await db.transaction()

    try {
      const counts = await this.repository.discardSessions(sessionHashes, transaction)

      if (options.apply) {
        await transaction.commit()
      } else {
        await transaction.rollback()
      }

      return { applied: options.apply, sessions_requested: sessionHashes.length, ...counts }
    } catch (error) {
      if (!transaction.isCompleted) {
        await transaction.rollback()
      }
      throw error
    }
  }
}

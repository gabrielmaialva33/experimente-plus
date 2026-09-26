import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'

/**
 * The day a quota belongs to. An operation has no timezone of its own — its
 * cities do — and every city of the pilot is in Paraná, so the day is the civil
 * day in Brasília time: a person's quota renews at their midnight, not at 21h
 * as a UTC day would make it.
 */
export const QUOTA_TIMEZONE = 'America/Sao_Paulo'

/** Longer than a day, so a counter always outlives the day it counts. */
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60

/**
 * Questions per signed-in person per day — ADR-0029, revision of 26/09/2026.
 *
 * What is counted is a model call about to happen, not a question received: a
 * refusal, a catalogue with nothing to offer and an assistant switched off cost
 * nothing, so they never reach this service. The public route has no person to
 * count and stays under its per-address throttle.
 */
export default class ConciergeQuotaService {
  /** The real Redis by default; a test hands in a store that fails. */
  constructor(private store: Pick<typeof redis, 'multi'> = redis) {}

  key(tenantId: number, userId: number, now: Date): string {
    const day = DateTime.fromJSDate(now, { zone: QUOTA_TIMEZONE }).toISODate()
    return `concierge:quota:v1:${tenantId}:${userId}:${day}`
  }

  /**
   * Takes one unit and says whether it fitted. Increment and expiry travel in
   * one transaction, so no counter is left without an end.
   *
   * It fails closed. Without Redis the service cannot tell whether the limit
   * was reached, and the side that costs money is the provider call, so the
   * answer degrades to the catalogue rather than letting the limit lapse.
   */
  async consume(tenantId: number, userId: number, limit: number, now = new Date()) {
    const key = this.key(tenantId, userId, now)
    try {
      const results = await this.store.multi().incr(key).expire(key, COUNTER_TTL_SECONDS).exec()
      const [error, count] = results?.[0] ?? [new Error('Empty Redis transaction'), null]
      if (error) throw error
      return Number(count) <= limit
    } catch (error) {
      logger.warn({ err: error }, 'Concierge quota unavailable; answering without the model')
      return false
    }
  }
}

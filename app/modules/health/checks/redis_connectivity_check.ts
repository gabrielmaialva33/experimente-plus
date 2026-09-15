import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'
import redis from '@adonisjs/redis/services/main'

export const REDIS_HEALTH_TIMEOUT_MS = 1_000

/**
 * Readiness must fail when Redis is unreachable.
 *
 * The rate limiter stores its counters there, so every throttled route answers
 * 500 while it is down — which is most of the public API. On 15/09/2026 that
 * happened for the better part of an hour and readiness kept reporting healthy,
 * because it only looked at the database. A probe that stays green through an
 * outage is worse than no probe: the deploy validates, the monitor is quiet,
 * and the first to notice is whoever opens the app.
 */
export class RedisConnectivityCheck extends BaseCheck {
  readonly name = 'Redis health check (main)'

  async run(): Promise<HealthCheckResult> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Redis did not answer within ${REDIS_HEALTH_TIMEOUT_MS}ms`)),
        REDIS_HEALTH_TIMEOUT_MS
      ).unref()
    )

    try {
      await Promise.race([redis.ping(), timeout])
      return Result.ok('Successfully connected to the Redis server')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis connectivity check failed'
      return Result.failed(message)
    }
  }
}

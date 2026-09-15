import type { HealthCheckReport } from '@adonisjs/core/types/health'

export const HEALTH_CHECK_DEADLINE_MS = 2_000

type HealthCheckRunner = {
  run(): Promise<HealthCheckReport>
}

export type PublicHealthResponse = {
  healthy: boolean
  services: {
    database: {
      healthy: boolean
    }
    redis: {
      healthy: boolean
    }
  }
}

export type DeadlineTimer = {
  schedule(callback: () => void, milliseconds: number): unknown
  clear(handle: unknown): void
}

type HealthReadinessDiagnostic =
  | { kind: 'report'; report: HealthCheckReport }
  | {
      kind: 'failure'
      error: Error
    }

export type HealthReadinessOutcome = {
  statusCode: 200 | 503
  body: PublicHealthResponse
  diagnostic?: HealthReadinessDiagnostic
}

const systemDeadlineTimer: DeadlineTimer = {
  schedule(callback, milliseconds) {
    const handle = setTimeout(callback, milliseconds)
    handle.unref()
    return handle
  },
  clear(handle) {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export class HealthCheckDeadlineError extends Error {
  readonly code = 'E_HEALTH_CHECK_DEADLINE'

  constructor(readonly deadlineMilliseconds: number) {
    super(`Health checks exceeded the ${deadlineMilliseconds}ms deadline`)
    this.name = 'HealthCheckDeadlineError'
  }
}

export async function withDeadline<T>(
  operation: () => Promise<T>,
  deadlineMilliseconds: number,
  timer: DeadlineTimer = systemDeadlineTimer
): Promise<T> {
  if (!Number.isSafeInteger(deadlineMilliseconds) || deadlineMilliseconds <= 0) {
    throw new Error('Health check deadline must be a positive integer')
  }

  let timerHandle: unknown
  const deadline = new Promise<never>((_resolve, reject) => {
    timerHandle = timer.schedule(
      () => reject(new HealthCheckDeadlineError(deadlineMilliseconds)),
      deadlineMilliseconds
    )
  })

  try {
    return await Promise.race([Promise.resolve().then(operation), deadline])
  } finally {
    if (timerHandle !== undefined) {
      timer.clear(timerHandle)
    }
  }
}

function isDatabaseCheck(check: HealthCheckReport['checks'][number]): boolean {
  return Boolean(check.meta?.connection)
}

/**
 * The limiter stores its counters in Redis, so a Redis outage turns most of the
 * public API into 500 while the process stays up. Reporting it separately is
 * what turns "unhealthy" into something an operator can act on.
 */
function isRedisCheck(check: HealthCheckReport['checks'][number]): boolean {
  return check.name.toLowerCase().includes('redis')
}

export function buildHealthResponse(report: HealthCheckReport): PublicHealthResponse {
  const databaseChecks = report.checks.filter(isDatabaseCheck)
  const redisChecks = report.checks.filter(isRedisCheck)

  return {
    healthy: report.isHealthy,
    services: {
      database: {
        healthy:
          databaseChecks.length > 0 && databaseChecks.every((check) => check.status !== 'error'),
      },
      redis: {
        healthy: redisChecks.length > 0 && redisChecks.every((check) => check.status !== 'error'),
      },
    },
  }
}

const unavailableHealthResponse = (): PublicHealthResponse => ({
  healthy: false,
  services: {
    database: {
      healthy: false,
    },
    redis: {
      healthy: false,
    },
  },
})

export async function runHealthReadiness(
  runner: HealthCheckRunner,
  options: {
    deadlineMilliseconds?: number
    timer?: DeadlineTimer
  } = {}
): Promise<HealthReadinessOutcome> {
  try {
    const report = await withDeadline(
      () => runner.run(),
      options.deadlineMilliseconds ?? HEALTH_CHECK_DEADLINE_MS,
      options.timer
    )

    return {
      statusCode: report.isHealthy ? 200 : 503,
      body: buildHealthResponse(report),
      diagnostic: report.status === 'ok' ? undefined : { kind: 'report', report },
    }
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Health checks failed')

    return {
      statusCode: 503,
      body: unavailableHealthResponse(),
      diagnostic: { kind: 'failure', error: normalizedError },
    }
  }
}

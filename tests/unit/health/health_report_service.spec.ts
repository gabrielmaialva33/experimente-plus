import type { HealthCheckReport } from '@adonisjs/core/types/health'
import { test } from '@japa/runner'

import {
  buildHealthResponse,
  type DeadlineTimer,
  HEALTH_CHECK_DEADLINE_MS,
  runHealthReadiness,
} from '#modules/health/services/health_report_service'

function reportWithDatabaseStatuses(
  statuses: Array<'ok' | 'warning' | 'error'>
): HealthCheckReport {
  return {
    isHealthy: !statuses.includes('error'),
    status: statuses.includes('error') ? 'error' : statuses.includes('warning') ? 'warning' : 'ok',
    finishedAt: new Date(),
    debugInfo: {
      pid: 1,
      uptime: 1,
      version: 'test',
      platform: 'test',
    },
    checks: statuses.map((status, index) => ({
      isCached: false,
      name: `Database check ${index + 1}`,
      status,
      message: status,
      finishedAt: new Date(),
      meta: {
        connection: {
          name: 'postgres',
          dialect: 'postgres',
        },
      },
    })),
  }
}

test.group('Health report service', () => {
  test('marks the database healthy when all database checks are non-error', ({ assert }) => {
    const response = buildHealthResponse(reportWithDatabaseStatuses(['ok', 'warning']))

    assert.isTrue(response.services.database.healthy)
  })

  test('marks the database unhealthy when any database check fails', ({ assert }) => {
    const response = buildHealthResponse(reportWithDatabaseStatuses(['ok', 'error']))

    assert.isFalse(response.services.database.healthy)
  })

  test('does not claim database health when no database check ran', ({ assert }) => {
    const report = reportWithDatabaseStatuses([])

    assert.isFalse(buildHealthResponse(report).services.database.healthy)
  })

  test('keeps raw check details out of the stable public response', ({ assert }) => {
    const report = reportWithDatabaseStatuses(['error'])
    report.checks[0].message =
      '37 connections for experimente_plus against capacity 15 at postgres.internal'

    const body = buildHealthResponse(report)
    const serializedBody = JSON.stringify(body)

    assert.deepEqual(Object.keys(body), ['healthy', 'services'])
    assert.notInclude(serializedBody, '37')
    assert.notInclude(serializedBody, 'experimente_plus')
    assert.notInclude(serializedBody, 'postgres.internal')
    assert.notProperty(body, 'checks')
  })

  test('returns 503 at the global deadline and clears the deadline timer', async ({ assert }) => {
    const activeTimers = new Map<object, () => void>()
    let scheduledMilliseconds: number | undefined
    const timer: DeadlineTimer = {
      schedule(callback, milliseconds) {
        const handle = {}
        scheduledMilliseconds = milliseconds
        activeTimers.set(handle, callback)
        return handle
      },
      clear(handle) {
        activeTimers.delete(handle as object)
      },
    }
    const neverSettles = new Promise<HealthCheckReport>(() => {})
    const outcomePromise = runHealthReadiness(
      { run: () => neverSettles },
      { timer, deadlineMilliseconds: HEALTH_CHECK_DEADLINE_MS }
    )

    assert.equal(scheduledMilliseconds, HEALTH_CHECK_DEADLINE_MS)
    assert.equal(activeTimers.size, 1)
    activeTimers.values().next().value?.()

    const outcome = await outcomePromise

    assert.equal(outcome.statusCode, 503)
    assert.deepEqual(outcome.body, {
      healthy: false,
      services: { database: { healthy: false } },
    })
    assert.equal(outcome.diagnostic?.kind, 'failure')
    assert.equal(activeTimers.size, 0)
  })

  test('clears the deadline timer after a successful report', async ({ assert }) => {
    const activeTimers = new Set<object>()
    const timer: DeadlineTimer = {
      schedule() {
        const handle = {}
        activeTimers.add(handle)
        return handle
      },
      clear(handle) {
        activeTimers.delete(handle as object)
      },
    }

    const outcome = await runHealthReadiness(
      { run: async () => reportWithDatabaseStatuses(['ok']) },
      { timer }
    )

    assert.equal(outcome.statusCode, 200)
    assert.equal(activeTimers.size, 0)
  })
})

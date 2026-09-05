import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { test } from '@japa/runner'

import {
  DATABASE_HEALTH_QUERY_TIMEOUT_MS,
  DatabaseConnectivityCheck,
} from '#modules/health/checks/database_connectivity_check'

test.group('Database connectivity check', () => {
  test('executes the probe with a cancellable database timeout', async ({ assert }) => {
    let executedSql = ''
    let timeout: { milliseconds: number; cancel: boolean } | undefined
    const client = {
      connectionName: 'postgres',
      dialect: { name: 'postgres' },
      rawQuery(sql: string) {
        executedSql = sql
        const query = {
          timeout(milliseconds: number, options: { cancel: boolean }) {
            timeout = { milliseconds, cancel: options.cancel }
            return query
          },
          async exec() {
            return { rows: [{ result: 1 }] }
          },
        }
        return query
      },
    } as unknown as QueryClientContract

    const result = await new DatabaseConnectivityCheck(client).run()

    assert.equal(result.status, 'ok')
    assert.equal(executedSql, 'SELECT 1')
    assert.deepEqual(timeout, {
      milliseconds: DATABASE_HEALTH_QUERY_TIMEOUT_MS,
      cancel: true,
    })
  })

  test('converts a timed-out query into a failed health result', async ({ assert }) => {
    const client = {
      connectionName: 'postgres',
      dialect: { name: 'postgres' },
      rawQuery() {
        const query = {
          timeout() {
            return query
          },
          async exec() {
            throw new Error('Database query timeout')
          },
        }
        return query
      },
    } as unknown as QueryClientContract

    const result = await new DatabaseConnectivityCheck(client).run()

    assert.equal(result.status, 'error')
    assert.equal(result.message, 'Database query timeout')
  })
})

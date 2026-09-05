import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { test } from '@japa/runner'

import { DATABASE_HEALTH_QUERY_TIMEOUT_MS } from '#modules/health/checks/database_connectivity_check'
import {
  connectionCapacityStatus,
  parsePostgresConnectionCapacity,
  PostgresConnectionCapacityCheck,
  type PostgresConnectionCapacityRow,
} from '#modules/health/checks/postgres_connection_capacity_check'

function createClient(options: {
  dialect?: string
  row?: PostgresConnectionCapacityRow
  onQuery?: (sql: string) => void
  onTimeout?: (milliseconds: number, cancel: boolean) => void
}): QueryClientContract {
  return {
    connectionName: 'postgres',
    dialect: { name: options.dialect ?? 'postgres' },
    rawQuery: (sql: string) => {
      options.onQuery?.(sql)
      const query = {
        timeout(milliseconds: number, timeoutOptions: { cancel: boolean }) {
          options.onTimeout?.(milliseconds, timeoutOptions.cancel)
          return query
        },
        async exec() {
          return { rows: options.row ? [options.row] : [] }
        },
      }

      return query
    },
  } as unknown as QueryClientContract
}

test.group('PostgreSQL connection capacity check', () => {
  test('attributes connections to the current database without using a fixed cluster count', async ({
    assert,
  }) => {
    let executedSql = ''
    const check = new PostgresConnectionCapacityCheck(
      createClient({
        row: {
          database_name: 'experimente_plus',
          database_connections: '4',
          cluster_connections: '37',
          max_connections: '100',
          reserved_connections: '3',
        },
        onQuery: (sql) => (executedSql = sql),
      })
    )

    const result = await check.run()

    assert.equal(result.status, 'ok')
    assert.include(result.message, '4 connections belong to the current application database')
    assert.include(result.message, '37 of 97 non-reserved connection slots')
    assert.equal(result.meta?.connections.databaseCount, 4)
    assert.equal(result.meta?.connections.clusterCount, 37)
    assert.include(executedSql, 'datname = current_database()')
    assert.include(executedSql, "backend_type = 'client backend'")
  })

  test('cancels a capacity query that exceeds the database deadline', async ({ assert }) => {
    let timeout: { milliseconds: number; cancel: boolean } | undefined
    const check = new PostgresConnectionCapacityCheck(
      createClient({
        row: {
          database_name: 'experimente_plus',
          database_connections: '4',
          cluster_connections: '37',
          max_connections: '100',
          reserved_connections: '3',
        },
        onTimeout: (milliseconds, cancel) => (timeout = { milliseconds, cancel }),
      })
    )

    await check.run()

    assert.deepEqual(timeout, {
      milliseconds: DATABASE_HEALTH_QUERY_TIMEOUT_MS,
      cancel: true,
    })
  })

  test('warns and fails against real usable capacity', ({ assert }) => {
    assert.equal(connectionCapacityStatus(79.9), 'ok')
    assert.equal(connectionCapacityStatus(80), 'warning')
    assert.equal(connectionCapacityStatus(94.9), 'warning')
    assert.equal(connectionCapacityStatus(95), 'error')
    assert.equal(connectionCapacityStatus(110), 'error')
  })

  test('parses PostgreSQL numeric strings and removes reserved slots from capacity', ({
    assert,
  }) => {
    assert.deepEqual(
      parsePostgresConnectionCapacity({
        database_name: 'experimente_plus',
        database_connections: '8',
        cluster_connections: '80',
        max_connections: '105',
        reserved_connections: '5',
      }),
      {
        databaseName: 'experimente_plus',
        databaseConnections: 8,
        clusterConnections: 80,
        usableConnections: 100,
        utilizationPercentage: 80,
      }
    )
  })

  test('fails closed when PostgreSQL returns invalid capacity metadata', async ({ assert }) => {
    const check = new PostgresConnectionCapacityCheck(
      createClient({
        row: {
          database_name: 'experimente_plus',
          database_connections: '2',
          cluster_connections: '10',
          max_connections: '3',
          reserved_connections: '3',
        },
      })
    )

    const result = await check.run()

    assert.equal(result.status, 'error')
    assert.equal(result.message, 'PostgreSQL returned invalid connection capacity metadata')
  })

  test('skips capacity inspection for non-PostgreSQL connections', async ({ assert }) => {
    let queried = false
    const check = new PostgresConnectionCapacityCheck(
      createClient({
        dialect: 'better-sqlite3',
        onQuery: () => (queried = true),
      })
    )

    const result = await check.run()

    assert.equal(result.status, 'ok')
    assert.include(result.message, 'Check skipped')
    assert.isFalse(queried)
  })
})

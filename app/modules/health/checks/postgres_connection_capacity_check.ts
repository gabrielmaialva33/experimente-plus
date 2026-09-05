import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import { DATABASE_HEALTH_QUERY_TIMEOUT_MS } from '#modules/health/checks/database_connectivity_check'

const WARNING_THRESHOLD_PERCENTAGE = 80
const FAILURE_THRESHOLD_PERCENTAGE = 95

const POSTGRES_CONNECTION_CAPACITY_QUERY = `
  SELECT
    current_database() AS database_name,
    COUNT(*) FILTER (
      WHERE backend_type = 'client backend'
        AND datname = current_database()
    )::integer AS database_connections,
    COUNT(*) FILTER (
      WHERE backend_type = 'client backend'
    )::integer AS cluster_connections,
    current_setting('max_connections')::integer AS max_connections,
    (
      current_setting('superuser_reserved_connections')::integer
      + COALESCE(current_setting('reserved_connections', true), '0')::integer
    ) AS reserved_connections
  FROM pg_stat_activity
  GROUP BY
    current_setting('max_connections'),
    current_setting('superuser_reserved_connections'),
    current_setting('reserved_connections', true)
`

type NumericDatabaseValue = number | string

export type PostgresConnectionCapacityRow = {
  database_name: string
  database_connections: NumericDatabaseValue
  cluster_connections: NumericDatabaseValue
  max_connections: NumericDatabaseValue
  reserved_connections: NumericDatabaseValue
}

export type PostgresConnectionCapacity = {
  databaseName: string
  databaseConnections: number
  clusterConnections: number
  usableConnections: number
  utilizationPercentage: number
}

function integerFromDatabase(value: NumericDatabaseValue, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL returned an invalid ${field} value`)
  }

  return parsed
}

export function parsePostgresConnectionCapacity(
  row: PostgresConnectionCapacityRow
): PostgresConnectionCapacity {
  const databaseConnections = integerFromDatabase(row.database_connections, 'database connections')
  const clusterConnections = integerFromDatabase(row.cluster_connections, 'cluster connections')
  const maxConnections = integerFromDatabase(row.max_connections, 'maximum connections')
  const reservedConnections = integerFromDatabase(row.reserved_connections, 'reserved connections')
  const usableConnections = maxConnections - reservedConnections

  if (
    !row.database_name ||
    usableConnections <= 0 ||
    clusterConnections > maxConnections ||
    databaseConnections > clusterConnections
  ) {
    throw new Error('PostgreSQL returned invalid connection capacity metadata')
  }

  return {
    databaseName: row.database_name,
    databaseConnections,
    clusterConnections,
    usableConnections,
    utilizationPercentage: (clusterConnections / usableConnections) * 100,
  }
}

export function connectionCapacityStatus(
  utilizationPercentage: number
): HealthCheckResult['status'] {
  if (utilizationPercentage >= FAILURE_THRESHOLD_PERCENTAGE) {
    return 'error'
  }

  if (utilizationPercentage >= WARNING_THRESHOLD_PERCENTAGE) {
    return 'warning'
  }

  return 'ok'
}

/**
 * Reports connections opened against this application's database while deciding
 * readiness from the PostgreSQL cluster's real non-reserved connection capacity.
 *
 * Lucid's stock connection-count check counts every row in `pg_stat_activity`
 * and compares the result with a fixed limit of 15. On a shared PostgreSQL
 * cluster, unrelated databases therefore make a healthy application unready.
 */
export class PostgresConnectionCapacityCheck extends BaseCheck {
  readonly name: string

  constructor(private readonly client: QueryClientContract) {
    super()
    this.name = `Database connection capacity check (${client.connectionName})`
  }

  async run(): Promise<HealthCheckResult> {
    const connectionMetadata = {
      connection: {
        name: this.client.connectionName,
        dialect: this.client.dialect.name,
      },
    }

    if (this.client.dialect.name !== 'postgres') {
      return Result.ok(`Check skipped for ${this.client.dialect.name} dialect`).mergeMetaData(
        connectionMetadata
      )
    }

    try {
      const result = await this.client
        .rawQuery<{ rows: PostgresConnectionCapacityRow[] }>(POSTGRES_CONNECTION_CAPACITY_QUERY)
        .timeout(DATABASE_HEALTH_QUERY_TIMEOUT_MS, { cancel: true })
        .exec()
      const row = result.rows[0]

      if (!row) {
        throw new Error('PostgreSQL did not return connection capacity metadata')
      }

      const capacity = parsePostgresConnectionCapacity(row)
      const status = connectionCapacityStatus(capacity.utilizationPercentage)
      const utilizationPercentage = Number(capacity.utilizationPercentage.toFixed(1))
      const message = `${capacity.databaseConnections} connections belong to the current application database; PostgreSQL is using ${capacity.clusterConnections} of ${capacity.usableConnections} non-reserved connection slots (${utilizationPercentage}%)`
      const metadata = {
        ...connectionMetadata,
        connections: {
          database: capacity.databaseName,
          databaseCount: capacity.databaseConnections,
          clusterCount: capacity.clusterConnections,
          usableCapacity: capacity.usableConnections,
          utilizationPercentage,
          warningThresholdPercentage: WARNING_THRESHOLD_PERCENTAGE,
          failureThresholdPercentage: FAILURE_THRESHOLD_PERCENTAGE,
        },
      }

      if (status === 'error') {
        return Result.failed(message).mergeMetaData(metadata)
      }

      if (status === 'warning') {
        return Result.warning(message).mergeMetaData(metadata)
      }

      return Result.ok(message).mergeMetaData(metadata)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection capacity check failed'

      return Result.failed(message).mergeMetaData(connectionMetadata)
    }
  }
}

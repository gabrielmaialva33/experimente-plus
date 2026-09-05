import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export const DATABASE_HEALTH_QUERY_TIMEOUT_MS = 1_000

/**
 * Connectivity check with an explicit query timeout. The framework check has
 * no deadline of its own, so a degraded pool could otherwise keep readiness
 * requests open until the driver's much longer timeout elapsed.
 */
export class DatabaseConnectivityCheck extends BaseCheck {
  readonly name: string

  constructor(private readonly client: QueryClientContract) {
    super()
    this.name = `Database health check (${client.connectionName})`
  }

  async run(): Promise<HealthCheckResult> {
    const connectionMetadata = {
      connection: {
        name: this.client.connectionName,
        dialect: this.client.dialect.name,
      },
    }

    try {
      const sql = this.client.dialect.name === 'oracledb' ? 'SELECT 1 FROM dual' : 'SELECT 1'

      await this.client
        .rawQuery(sql)
        .timeout(DATABASE_HEALTH_QUERY_TIMEOUT_MS, {
          cancel: this.client.dialect.name === 'postgres',
        })
        .exec()

      return Result.ok('Successfully connected to the database server').mergeMetaData(
        connectionMetadata
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database connectivity check failed'

      return Result.failed(message).mergeMetaData(connectionMetadata)
    }
  }
}

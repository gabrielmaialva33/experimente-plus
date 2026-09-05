import {
  DiskSpaceCheck,
  HealthChecks,
  MemoryHeapCheck,
  MemoryRSSCheck,
} from '@adonisjs/core/health'
import db from '@adonisjs/lucid/services/db'

import { DatabaseConnectivityCheck } from '#modules/health/checks/database_connectivity_check'
import { PostgresConnectionCapacityCheck } from '#modules/health/checks/postgres_connection_capacity_check'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),

  /**
   * The stock thresholds are absolute (fail above ~350 MB of RSS), which any
   * real Node process blows past — a dev server with HMR and source maps sits
   * around 1.5 GB, so `/api/v1/health` answered 503 permanently. Percentages
   * scale with the host instead, and are what actually indicates trouble.
   */
  new MemoryHeapCheck().warnWhenExceedsPercentage(80).failWhenExceedsPercentage(90),
  new MemoryRSSCheck().warnWhenExceedsPercentage(70).failWhenExceedsPercentage(85),

  new DatabaseConnectivityCheck(db.connection()),
  new PostgresConnectionCapacityCheck(db.connection()),
])

import type { HealthReadinessOutcome } from '#modules/health/services/health_report_service'

export const HEALTH_DIAGNOSTIC_LOG_COOLDOWN_MS = 5 * 60 * 1_000

export type HealthDiagnosticLogger = {
  error(context: Record<string, unknown>, message: string): unknown
  warn(context: Record<string, unknown>, message: string): unknown
  info(context: Record<string, unknown>, message: string): unknown
}

type HealthReadinessDiagnostic = NonNullable<HealthReadinessOutcome['diagnostic']>
type DegradedLevel = 'warning' | 'error'

type ReporterState = {
  level: DegradedLevel
  fingerprint: string
  degradedAt: number
  lastLoggedAt: number
}

function errorCode(error: Error): string {
  const code = (error as Error & { code?: unknown }).code
  return typeof code === 'string' ? code : 'unknown'
}

function diagnosticLevel(diagnostic: HealthReadinessDiagnostic): DegradedLevel {
  if (diagnostic.kind === 'failure' || diagnostic.report.status === 'error') {
    return 'error'
  }

  return 'warning'
}

function diagnosticFingerprint(diagnostic: HealthReadinessDiagnostic): string {
  if (diagnostic.kind === 'failure') {
    return `failure:${diagnostic.error.name}:${errorCode(diagnostic.error)}`
  }

  const affectedChecks = diagnostic.report.checks
    .filter((check) => check.status !== 'ok')
    .map((check) => `${check.name}:${check.status}`)
    .sort()
    .join('|')

  return `report:${diagnostic.report.status}:${affectedChecks || 'unknown'}`
}

/**
 * Rate-limits health diagnostics per process while preserving state changes.
 * A changed severity/cause is logged immediately, unchanged degradation emits
 * one reminder per cooldown, and recovery is logged exactly once.
 */
export class HealthDiagnosticReporter {
  private state?: ReporterState
  private readonly clock: () => number
  private readonly cooldownMilliseconds: number

  constructor(
    options: {
      clock?: () => number
      cooldownMilliseconds?: number
    } = {}
  ) {
    this.clock = options.clock ?? Date.now
    this.cooldownMilliseconds = options.cooldownMilliseconds ?? HEALTH_DIAGNOSTIC_LOG_COOLDOWN_MS

    if (!Number.isSafeInteger(this.cooldownMilliseconds) || this.cooldownMilliseconds <= 0) {
      throw new Error('Health diagnostic log cooldown must be a positive integer')
    }
  }

  record(outcome: HealthReadinessOutcome, logger: HealthDiagnosticLogger): void {
    const now = this.clock()
    const diagnostic = outcome.diagnostic

    if (!diagnostic) {
      if (this.state) {
        logger.info(
          {
            previous_status: this.state.level,
            degraded_for_ms: Math.max(0, now - this.state.degradedAt),
          },
          'Health readiness recovered'
        )
        this.state = undefined
      }

      return
    }

    const level = diagnosticLevel(diagnostic)
    const fingerprint = diagnosticFingerprint(diagnostic)
    const previousState = this.state
    const isTransition =
      !previousState || previousState.level !== level || previousState.fingerprint !== fingerprint
    const cooldownElapsed =
      previousState !== undefined && now - previousState.lastLoggedAt >= this.cooldownMilliseconds
    const shouldLog = isTransition || cooldownElapsed

    this.state = {
      level,
      fingerprint,
      degradedAt: previousState?.degradedAt ?? now,
      lastLoggedAt: shouldLog ? now : (previousState?.lastLoggedAt ?? now),
    }

    if (!shouldLog) {
      return
    }

    const logContext =
      diagnostic.kind === 'report'
        ? { health_report: diagnostic.report, health_fingerprint: fingerprint }
        : { err: diagnostic.error, health_fingerprint: fingerprint }

    if (level === 'error') {
      logger.error(logContext, 'Health readiness is unavailable')
      return
    }

    logger.warn(logContext, 'Health readiness is degraded')
  }
}

export const healthDiagnosticReporter = new HealthDiagnosticReporter()

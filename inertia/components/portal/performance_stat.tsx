import { ArrowDownRight, ArrowUpRight, Equal, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import type { MetricChange } from '~/lib/performance'
import { cn } from '~/lib/utils'

const changeTone: Record<MetricChange['direction'], string> = {
  up: 'text-success-accent',
  down: 'text-warning-accent',
  same: 'text-muted-foreground',
  none: 'text-muted-foreground',
}

const changeIcon: Record<MetricChange['direction'], LucideIcon | null> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  same: Equal,
  none: null,
}

/**
 * How a number moved, in words a screen reader reads whole; the arrow and the
 * colour only repeat it for the eye.
 */
export function PerformanceChange({ change }: { change: MetricChange }) {
  const Icon = changeIcon[change.direction]

  return (
    <p
      data-direction={change.direction}
      className={cn(
        'mt-1 flex items-start gap-1 text-xs font-semibold',
        changeTone[change.direction]
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" /> : null}
      <span aria-hidden="true">{change.label}</span>
      <span className="sr-only">{change.description}</span>
    </p>
  )
}

interface PerformanceStatProps {
  label: string
  /** The number, already formatted. Without one, `children` explains why. */
  value?: string
  icon: LucideIcon
  change?: MetricChange | null
  hint?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * One number of the "Desempenho" page. On a phone two share a row, so the icon
 * stays out until there is room for it.
 */
export function PerformanceStat({
  label,
  value,
  icon: Icon,
  change,
  hint,
  children,
  className,
}: PerformanceStatProps) {
  const labelId = useId()

  return (
    <article
      aria-labelledby={labelId}
      className={cn(
        'flex min-w-0 flex-col rounded-card border border-border-subtle bg-card p-4 sm:p-5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={labelId} className="text-sm font-semibold text-muted-foreground">
          {label}
        </h3>
        <span className="hidden rounded-xl bg-primary-soft p-2.5 text-primary-accent sm:block">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      {value !== undefined ? (
        <p className="mt-1 font-display text-3xl font-extrabold tabular-nums tracking-[-0.02em] sm:text-4xl">
          {value}
        </p>
      ) : null}
      {change ? <PerformanceChange change={change} /> : null}
      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {children}
    </article>
  )
}

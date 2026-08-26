import { Link } from '@inertiajs/react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '~/components/ui/card'
import { cn } from '~/lib/utils'

type MetricTone = 'primary' | 'success' | 'warning' | 'info' | 'neutral'

const toneStyles: Record<MetricTone, string> = {
  primary: 'bg-primary/10 text-primary ring-primary/10',
  success: 'bg-success/10 text-success ring-success/10',
  warning: 'bg-warning/15 text-warning-foreground ring-warning/15',
  info: 'bg-info/10 text-info ring-info/10',
  neutral: 'bg-muted text-muted-foreground ring-border/70',
}

interface MetricCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  helper?: ReactNode
  href?: string
  linkLabel?: string
  tone?: MetricTone
  className?: string
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  helper,
  href,
  linkLabel = 'Ver detalhes',
  tone = 'primary',
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'group overflow-hidden border-border/70 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md',
        className
      )}
    >
      <CardContent className="relative flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] tabular-nums">{value}</p>
          {helper && <div className="mt-1.5 text-xs text-muted-foreground">{helper}</div>}
          {href && (
            <Link
              href={href}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline hover:underline-offset-4"
            >
              {linkLabel}
              <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>

        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-200 group-hover:scale-105',
            toneStyles[tone]
          )}
        >
          <Icon className="size-5" />
        </span>

        <span className="pointer-events-none absolute -bottom-10 -end-8 size-24 rounded-full bg-primary/[0.035] transition-transform duration-300 group-hover:scale-125" />
      </CardContent>
    </Card>
  )
}

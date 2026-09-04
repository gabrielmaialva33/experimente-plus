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
  const card = (
    <Card
      className={cn(
        'h-full overflow-hidden border-border bg-card shadow-none',
        href && 'transition-colors group-hover:border-primary/40',
        !href && className
      )}
    >
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] tabular-nums">{value}</p>
          {helper && <div className="mt-1.5 text-xs text-muted-foreground">{helper}</div>}
          {href && (
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline group-hover:underline-offset-4">
              {linkLabel}
              <ArrowUpRight className="size-3" />
            </span>
          )}
        </div>

        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md ring-1',
            toneStyles[tone]
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {card}
    </Link>
  )
}

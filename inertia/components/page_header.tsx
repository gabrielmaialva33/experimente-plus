import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  icon?: LucideIcon
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

/**
 * Shared heading for authenticated product surfaces. It carries the same visual
 * hierarchy across the partner portal, operational backoffice and platform
 * administration without moving domain decisions into the browser.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-[1.8rem]">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export default PageHeader

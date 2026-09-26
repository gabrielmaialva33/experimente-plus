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
      data-slot="page-header"
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[1.875rem] font-extrabold leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-muted-foreground">{description}</p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div data-slot="page-header-actions" className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}

export default PageHeader

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
  // The heading keeps at least 24rem before the actions share its row; wider actions
  // (filters, three buttons) move to their own row instead of squeezing the title into
  // one word per line on a tablet or a small laptop.
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}
    >
      <div className="flex min-w-0 flex-[1_1_24rem] items-start gap-3">
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
        <div
          data-slot="page-header-actions"
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-full"
        >
          {actions}
        </div>
      )}
    </header>
  )
}

export default PageHeader

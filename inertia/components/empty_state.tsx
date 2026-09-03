import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon | null
  headingLevel?: 2 | 3 | 4
  children?: ReactNode
  className?: string
}

/** Canonical empty state for public and authenticated product surfaces. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  headingLevel = 3,
  children,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'

  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <Heading className="text-lg font-semibold leading-6">{title}</Heading>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && (
        <div data-slot="empty-state-actions" className="mt-5 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

export type { EmptyStateProps }

import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

interface CatalogSectionHeaderProps {
  id: string
  title: ReactNode
  overline?: ReactNode
  description?: ReactNode
  descriptionId?: string
  /** An action aligned to the right of the title, such as a "Ver todos" link. */
  action?: ReactNode
  level?: 2 | 3
  className?: string
}

/**
 * Direction A's section header on the public catalogue: an overline, a
 * display title and, when there is one, a single action to the right.
 */
export function CatalogSectionHeader({
  id,
  title,
  overline,
  description,
  descriptionId,
  action,
  level = 2,
  className,
}: CatalogSectionHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'

  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <div className="min-w-0 max-w-3xl">
        {overline ? (
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            {overline}
          </p>
        ) : null}
        <Heading
          id={id}
          className={cn(
            'font-display font-extrabold leading-tight tracking-[-0.01em]',
            level === 2 ? 'text-[1.3125rem] sm:text-2xl' : 'text-lg',
            overline ? 'mt-1' : null
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

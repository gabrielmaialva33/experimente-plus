import { Link } from '@inertiajs/react'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

type TaskCardProps = {
  /** What the task is about, read first. */
  title: string
  /** The headline number, when the task is a count. */
  value?: ReactNode
  /** Nothing pending reads quieter than work waiting. */
  tone?: 'primary' | 'muted'
  /** State badges or other inline facts between the number and the action. */
  children?: ReactNode
  description?: ReactNode
  href: string
  actionLabel: string
  className?: string
}

/**
 * A task on a landing screen — direction A: one card is one link, the number
 * in the display face, the action at the foot. The whole card is the target so
 * it is never smaller than the thumb, and the card carries no second control.
 */
export function TaskCard({
  title,
  value,
  tone = 'primary',
  children,
  description,
  href,
  actionLabel,
  className,
}: TaskCardProps) {
  return (
    <Link
      href={href}
      data-slot="task-card"
      className={cn(
        'group flex min-h-44 flex-col gap-2.5 rounded-card border border-border-subtle bg-card p-5 text-card-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
        className
      )}
    >
      <span className="text-[0.9375rem] font-bold text-muted-foreground">{title}</span>
      {value !== undefined && (
        <span
          data-slot="task-card-value"
          className={cn(
            'font-display text-[2.75rem] font-extrabold leading-none',
            tone === 'primary' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {value}
        </span>
      )}
      {children}
      {description && <span className="text-sm text-muted-foreground">{description}</span>}
      <span className="mt-auto inline-flex items-center gap-1 text-[0.9375rem] font-extrabold text-primary">
        {actionLabel}
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
    </Link>
  )
}

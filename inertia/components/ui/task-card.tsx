import { Link } from '@inertiajs/react'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

type TaskCardProps = {
  /** What the task is about; a heading, so screen readers can jump between tasks. */
  title: string
  headingLevel?: 2 | 3
  icon?: LucideIcon
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
 * A task on a landing screen — direction A: the number in the display face and
 * the action at the foot. The action link is stretched over the whole card, so
 * the card is one generous target while the title stays a heading and the link
 * keeps a short, meaningful name.
 */
export function TaskCard({
  title,
  headingLevel = 2,
  icon: Icon,
  value,
  tone = 'primary',
  children,
  description,
  href,
  actionLabel,
  className,
}: TaskCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'

  return (
    <article
      data-slot="task-card"
      className={cn(
        'group relative flex min-h-44 flex-col gap-2.5 rounded-card border border-border-subtle bg-card p-5 text-card-foreground transition-colors hover:border-border motion-reduce:transition-none',
        className
      )}
    >
      <Heading className="flex items-center gap-2 text-[0.9375rem] font-bold text-muted-foreground">
        {Icon && <Icon aria-hidden="true" className="size-4" />}
        {title}
      </Heading>
      {value !== undefined && (
        <p
          data-slot="task-card-value"
          className={cn(
            'font-display text-[2.75rem] font-extrabold leading-none tabular-nums',
            tone === 'primary' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {value}
        </p>
      )}
      {children}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <Link
        href={href}
        className="mt-auto inline-flex min-h-11 items-center gap-1 self-start text-[0.9375rem] font-extrabold text-primary outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
      >
        {actionLabel}
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Link>
    </article>
  )
}

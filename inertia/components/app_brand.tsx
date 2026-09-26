import { Link } from '@inertiajs/react'

import { useApp } from '~/hooks/use_app'
import { cn } from '~/lib/utils'

interface AppBrandProps {
  collapsed?: boolean
  href?: string
  className?: string
  onNavigate?: () => void
  /** `inverse` sits on the authenticated chrome: a light plate for the mark, light text. */
  tone?: 'default' | 'inverse'
}

export function BrandMark({
  className,
  tone = 'default',
}: {
  className?: string
  tone?: 'default' | 'inverse'
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md border',
        tone === 'inverse'
          ? 'border-chrome-active bg-chrome-active text-chrome-active-foreground'
          : 'border-primary bg-primary text-primary-foreground',
        className
      )}
    >
      <span className="text-sm font-black tracking-[-0.08em]">E+</span>
    </span>
  )
}

export function AppBrand({
  collapsed = false,
  href = '/',
  className,
  onNavigate,
  tone = 'default',
}: AppBrandProps) {
  const application = useApp()

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={application.name}
      className={cn('flex min-w-0 items-center gap-3', className)}
    >
      <BrandMark tone={tone} />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate font-display text-[1.125rem] font-extrabold tracking-[-0.02em]">
            {application.name}
          </span>
          <span
            className={cn(
              'block truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em]',
              tone === 'inverse' ? 'text-chrome-muted' : 'text-muted-foreground'
            )}
          >
            Descoberta regional
          </span>
        </span>
      )}
    </Link>
  )
}

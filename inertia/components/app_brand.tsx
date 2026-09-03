import { Link } from '@inertiajs/react'

import { useApp } from '~/hooks/use_app'
import { cn } from '~/lib/utils'

interface AppBrandProps {
  collapsed?: boolean
  href?: string
  className?: string
  onNavigate?: () => void
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground',
        className
      )}
    >
      <span className="text-sm font-black tracking-[-0.08em]">E+</span>
    </span>
  )
}

export function AppBrand({
  collapsed = false,
  href = '/dashboard',
  className,
  onNavigate,
}: AppBrandProps) {
  const application = useApp()

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={application.name}
      className={cn('flex min-w-0 items-center gap-3', className)}
    >
      <BrandMark />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-[1.05rem] font-bold tracking-[-0.03em]">
            {application.name}
          </span>
          <span className="block truncate text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Descoberta regional
          </span>
        </span>
      )}
    </Link>
  )
}

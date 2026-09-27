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
  /** Classes for the name beside the mark, e.g. to hide it where a header runs out of room. */
  wordmarkClassName?: string
  /** Classes for the tagline under the name, e.g. to drop it on a phone too narrow for it. */
  taglineClassName?: string
}

/**
 * The provisional E+ monogram of direction A (the app icon uses the same
 * shapes): a pill-built E in the tile's foreground, the + in the action color.
 */
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
      <svg viewBox="-280 -305 560 560" className="size-6" focusable="false">
        <g fill="currentColor">
          <rect x="-247" y="-224" width="100" height="448" rx="50" />
          <rect x="-247" y="-224" width="250" height="100" rx="50" />
          <rect x="-247" y="-50" width="214" height="100" rx="50" />
          <rect x="-247" y="124" width="300" height="100" rx="50" />
        </g>
        <g className="fill-cta">
          <rect x="47" y="-205" width="200" height="62" rx="31" />
          <rect x="116" y="-274" width="62" height="200" rx="31" />
        </g>
      </svg>
    </span>
  )
}

export function AppBrand({
  collapsed = false,
  href = '/',
  className,
  onNavigate,
  tone = 'default',
  wordmarkClassName,
  taglineClassName,
}: AppBrandProps) {
  const application = useApp()

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={application.name}
      // 44 px tall on every header, and 44 px wide when only the mark shows.
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-3',
        collapsed && 'min-w-11 justify-center',
        className
      )}
    >
      <BrandMark tone={tone} />
      {!collapsed && (
        <span className={cn('min-w-0', wordmarkClassName)}>
          <span className="block truncate font-display text-[1.125rem] font-extrabold tracking-[-0.02em]">
            {application.name}
          </span>
          <span
            className={cn(
              'block truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em]',
              tone === 'inverse' ? 'text-chrome-muted' : 'text-muted-foreground',
              taglineClassName
            )}
          >
            Descoberta regional
          </span>
        </span>
      )}
    </Link>
  )
}

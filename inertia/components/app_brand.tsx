import { Link } from '@inertiajs/react'

import { brandSymbol, fullLogo } from '~/components/brand_marks'
import { useApp } from '~/hooks/use_app'
import { cn } from '~/lib/utils'

interface AppBrandProps {
  collapsed?: boolean
  href?: string
  className?: string
  onNavigate?: () => void
  /** `inverse` sits on the deep-purple chrome: the logo goes all white, as the brand asks. */
  tone?: 'default' | 'inverse'
  /** Classes for the full logo, e.g. to hide it where a header runs out of room. */
  wordmarkClassName?: string
  /**
   * Classes for the e+ tile beside or instead of the logo. It is hidden unless
   * collapsed, so a header that hides the logo shows it here (`hidden md:max-lg:flex`).
   */
  markClassName?: string
}

/**
 * The e+ symbol of the app icon on its tile: white on the brand violet, and on
 * the chrome the light plate the sidebar already uses for the active item.
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
        'flex size-9 shrink-0 items-center justify-center rounded-[0.6rem]',
        tone === 'inverse'
          ? 'bg-chrome-active text-chrome-active-foreground'
          : 'bg-primary text-primary-foreground',
        className
      )}
    >
      <svg viewBox={brandSymbol.viewBox} className="size-6" focusable="false">
        <path fill="currentColor" d={brandSymbol.d} />
      </svg>
    </span>
  )
}

/**
 * The full "experimente+" logo. The letters follow the text color; the smile and
 * the + are violet on a light page and white elsewhere (dark page, chrome), which
 * is the brand's rule for dark backgrounds.
 */
export function BrandLogo({
  className,
  tone = 'default',
}: {
  className?: string
  tone?: 'default' | 'inverse'
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={fullLogo.viewBox}
      focusable="false"
      className={cn(
        'h-7 w-auto shrink-0',
        tone === 'inverse' ? 'text-chrome-foreground' : 'text-foreground',
        className
      )}
    >
      <path fill="currentColor" d={fullLogo.letters} />
      <path
        className={tone === 'inverse' ? 'fill-current' : 'fill-primary dark:fill-current'}
        d={fullLogo.accents}
      />
    </svg>
  )
}

export function AppBrand({
  collapsed = false,
  href = '/',
  className,
  onNavigate,
  tone = 'default',
  wordmarkClassName,
  markClassName,
}: AppBrandProps) {
  const application = useApp()

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={application.name}
      // 44 x 44 px at least, also where a header hides the logo and only the mark shows.
      className={cn(
        'flex min-h-11 min-w-11 items-center gap-3',
        collapsed && 'justify-center',
        className
      )}
    >
      {collapsed ? (
        <BrandMark tone={tone} />
      ) : (
        <>
          <BrandMark tone={tone} className={cn('hidden', markClassName)} />
          <BrandLogo tone={tone} className={wordmarkClassName} />
        </>
      )}
    </Link>
  )
}

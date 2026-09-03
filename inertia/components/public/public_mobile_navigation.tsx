import { Link, router, usePage } from '@inertiajs/react'

import { isNavigationHrefActive, publicNavigationItemsFor } from '~/config/navigation'
import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

export function PublicMobileNavigation() {
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const authenticated = Boolean(auth?.user)
  const items = publicNavigationItemsFor('mobile', {
    authenticated,
    activeTenantId: auth?.activeTenantId ?? null,
  })

  return (
    <nav
      aria-label="Navegação móvel"
      className="fixed inset-x-0 bottom-0 z-50 min-h-[var(--public-mobile-navigation-space)] border-t bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-1.5 md:hidden"
    >
      <div
        className="mx-auto grid max-w-md gap-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isNavigationHrefActive(url, item.href)
          const Icon = item.icon
          const className = cn(
            'flex min-h-13 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-semibold transition-colors',
            active
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )

          return item.method === 'post' ? (
            <button
              key={item.href}
              type="button"
              className={className}
              onClick={() => router.post(item.href)}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

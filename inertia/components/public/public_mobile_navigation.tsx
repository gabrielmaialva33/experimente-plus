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
    hasActiveOrganizationMembership: auth?.hasActiveOrganizationMembership ?? false,
    platformAccess: auth?.platformAccess ?? null,
  })

  return (
    <nav
      data-mobile-tab-bar
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
          // Same grammar as the wallet's bar: the active icon sits in a pill, the label below.
          // Icons share one baseline even when a label takes two lines on a 320 px phone. On a
          // short screen (a phone on its side) the label moves beside the icon, as a compact
          // tab bar, to give the height back to the content.
          const className = cn(
            'group flex min-h-13 min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 text-[0.6875rem] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring short:min-h-11 short:flex-row short:justify-center short:gap-2 short:text-xs',
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )
          const content = (
            <>
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active ? 'bg-primary-soft' : 'group-hover:bg-accent'
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              {/* Two lines before an ellipsis: "Cadastrar negócio" did not fit a 320 px third. */}
              <span className="line-clamp-2 max-w-full text-center leading-[1.1] short:line-clamp-none short:whitespace-nowrap">
                {item.label}
              </span>
            </>
          )

          return item.method === 'post' ? (
            <button
              key={item.href}
              type="button"
              className={className}
              onClick={() => router.post(item.href)}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              {content}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

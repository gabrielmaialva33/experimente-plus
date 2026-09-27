import { Link, router, usePage } from '@inertiajs/react'

import { AppBrand } from '~/components/app_brand'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { Button } from '~/components/ui/button'
import { isNavigationHrefActive, publicNavigationItemsFor } from '~/config/navigation'
import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

export function PublicHeader() {
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const authenticated = Boolean(auth?.user)
  const availability = {
    authenticated,
    activeTenantId: auth?.activeTenantId ?? null,
    hasActiveOrganizationMembership: auth?.hasActiveOrganizationMembership ?? false,
    platformAccess: auth?.platformAccess ?? null,
  }
  const navigation = publicNavigationItemsFor('header', availability)
  const utilityItems = publicNavigationItemsFor('utility', availability)

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="app-container flex min-h-16 items-center justify-between gap-4 py-2">
        {/* Signed in, the bar carries up to five destinations: between 768 and 1024 px the
            name was truncated to "Exp…", so there the mark stands alone (it keeps its label). */}
        <AppBrand href="/" wordmarkClassName={authenticated ? 'md:max-lg:hidden' : undefined} />

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => {
            const active = isNavigationHrefActive(url, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {utilityItems.map((item) => {
            const Icon = item.icon

            return item.method === 'post' ? (
              <Button
                key={item.href}
                type="button"
                variant="ghost"
                size="md"
                shape="pill"
                className="hidden md:inline-flex"
                onClick={() => router.post(item.href)}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Button>
            ) : (
              <Button
                key={item.href}
                variant={authenticated ? 'outline' : 'ghost'}
                size="md"
                shape="pill"
                className="hidden md:inline-flex"
                asChild
              >
                <Link href={item.href}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>
    </header>
  )
}

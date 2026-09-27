import { Link, router, usePage } from '@inertiajs/react'
import { LogOut } from 'lucide-react'
import type { PropsWithChildren } from 'react'

import { AppBrand } from '~/components/app_brand'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { Button } from '~/components/ui/button'
import { isNavigationItemActive, navigationItemsForSurface } from '~/config/navigation'
import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

export function ConsumerShell({ children }: PropsWithChildren) {
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const navigation = navigationItemsForSurface('consumer', 'consumer-shell', {
    activeTenantId: auth?.activeTenantId ?? null,
  })

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)] short:static">
        <div className="app-container flex min-h-16 items-center gap-4 py-2">
          {/* Beside two 44 px actions a 320 px phone cut the tagline to "Descoberta reg…". */}
          <AppBrand href="/cidades" taglineClassName="max-[360px]:hidden" />

          <nav
            className="ms-auto hidden items-center gap-1 md:flex"
            aria-label="Navegação do consumidor"
          >
            {navigation.map((item) => {
              const Icon = item.icon
              const selected = isNavigationItemActive(url, item, navigation)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold pointer-coarse:min-h-11 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selected
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

          <div className="ms-auto flex items-center gap-1 md:ms-2">
            <ThemeToggle />
            {/* Same exit as the public header: labelled on a wide screen, an icon on a phone. */}
            <Button
              type="button"
              variant="ghost"
              size="md"
              shape="pill"
              className="w-10 px-0 pointer-coarse:h-11 max-md:pointer-coarse:w-11 md:w-auto md:px-4"
              aria-label="Sair"
              onClick={() => router.post('/logout')}
            >
              <LogOut aria-hidden="true" />
              <span aria-hidden="true" className="hidden md:inline">
                Sair
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="app-container pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 outline-none md:pb-10 md:pt-8"
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:hidden"
        aria-label="Navegação principal"
        data-mobile-tab-bar
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
        >
          {navigation.map((item) => {
            const Icon = item.icon
            const selected = isNavigationItemActive(url, item, navigation)
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'group flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[0.6875rem] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring short:min-h-11 short:flex-row short:gap-2 short:py-1 short:text-xs',
                  selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    selected ? 'bg-primary-soft' : 'group-hover:bg-accent'
                  )}
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

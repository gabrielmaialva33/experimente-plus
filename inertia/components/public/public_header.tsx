import { Link, usePage } from '@inertiajs/react'
import { LogIn, Store } from 'lucide-react'

import { AppBrand } from '~/components/app_brand'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { Button } from '~/components/ui/button'
import { isNavigationHrefActive, PUBLIC_NAVIGATION } from '~/config/navigation'
import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

export function PublicHeader() {
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const authenticated = Boolean(auth?.user)
  const navigation = PUBLIC_NAVIGATION.header[authenticated ? 'authenticated' : 'guest']

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="app-container flex min-h-16 items-center justify-between gap-4 py-2">
        <AppBrand href="/" />

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => {
            const active = isNavigationHrefActive(url, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {authenticated ? (
            <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
              <Link href="/portal">
                <Store /> Portal
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
              <Link href="/login">
                <LogIn /> Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

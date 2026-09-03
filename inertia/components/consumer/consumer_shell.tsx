import { Link, usePage } from '@inertiajs/react'
import { Compass } from 'lucide-react'
import type { PropsWithChildren } from 'react'

import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { isNavigationItemActive, navigationItemsForSurface } from '~/config/navigation'
import { cn } from '~/lib/utils'

const navigation = navigationItemsForSurface('consumer', 'consumer-shell')

export function ConsumerShell({ children }: PropsWithChildren) {
  const { url } = usePage()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="app-container flex min-h-16 items-center justify-between gap-4">
          <Link
            href="/cidades"
            className="group flex items-center gap-3"
            aria-label="Experimente+ — início"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
              <Compass className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[-0.03em]">Experimente+</span>
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Descubra perto de você
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação do consumidor">
            {navigation.map((item) => {
              const Icon = item.icon
              const selected = isNavigationItemActive(url, item, navigation)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-lg grid-cols-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const selected = isNavigationItemActive(url, item, navigation)
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.68rem] font-semibold transition-colors',
                  selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex min-h-8 min-w-12 items-center justify-center rounded-full transition-colors',
                    selected && 'bg-primary/12'
                  )}
                >
                  <Icon className="size-5" />
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

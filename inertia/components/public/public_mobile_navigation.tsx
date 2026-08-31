import { Link, usePage } from '@inertiajs/react'
import { Compass, LogIn, Settings, Store, TicketPercent, UserPlus } from 'lucide-react'

import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

function isActivePath(currentUrl: string, href: string): boolean {
  if (href === '/') return currentUrl === '/'
  return currentUrl === href || currentUrl.startsWith(`${href}/`)
}

export function PublicMobileNavigation() {
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const authenticated = Boolean(auth?.user)
  const items = authenticated
    ? [
        { label: 'Explorar', href: '/cidades', icon: Compass },
        { label: 'Carteira', href: '/carteira', icon: TicketPercent },
        { label: 'Portal', href: '/portal', icon: Store },
        { label: 'Perfil', href: '/settings', icon: Settings },
      ]
    : [
        { label: 'Explorar', href: '/cidades', icon: Compass },
        { label: 'Entrar', href: '/login', icon: LogIn },
        { label: 'Cadastrar', href: '/register', icon: UserPlus },
      ]

  return (
    <nav
      aria-label="Navegação móvel"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/94 px-[max(0.5rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_32px_-22px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
    >
      <div
        className={cn(
          'mx-auto grid max-w-md gap-1',
          authenticated ? 'grid-cols-4' : 'grid-cols-3'
        )}
      >
        {items.map((item) => {
          const active = isActivePath(url, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-semibold transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4.5" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

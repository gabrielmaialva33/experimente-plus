import { Link, usePage } from '@inertiajs/react'
import { Compass, LayoutDashboard, LogIn, Menu, Store, TicketPercent } from 'lucide-react'
import { useState } from 'react'

import { AppBrand } from '~/components/app_brand'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { cn } from '~/lib/utils'
import type { AuthSharedProps } from '~/types'

function isActivePath(currentUrl: string, href: string): boolean {
  if (href === '/') return currentUrl === '/'
  return currentUrl === href || currentUrl.startsWith(`${href}/`)
}

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { url, props } = usePage()
  const auth = props.auth as AuthSharedProps | undefined
  const authenticated = Boolean(auth?.user)
  const navigation = authenticated
    ? [
        { label: 'Explorar', href: '/cidades', icon: Compass },
        { label: 'Minha carteira', href: '/carteira', icon: TicketPercent },
      ]
    : [
        { label: 'Explorar', href: '/cidades', icon: Compass },
        { label: 'Para parceiros', href: '/register', icon: Store },
      ]

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <div className="mx-auto flex h-17 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <AppBrand href="/" />

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => {
            const active = isActivePath(url, item.href)
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
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                <Link href="/carteira">
                  <TicketPercent />
                  Carteira
                </Link>
              </Button>
              <Button className="hidden md:inline-flex" asChild>
                <Link href="/portal">
                  <LayoutDashboard />
                  Portal
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button className="hidden md:inline-flex" asChild>
                <Link href="/register">Criar conta</Link>
              </Button>
            </>
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                mode="icon"
                aria-label="Abrir menu"
                className="md:hidden"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(88vw,22rem)] p-0">
              <SheetHeader className="border-b px-6 py-5 text-start">
                <SheetTitle>
                  {authenticated ? 'Sua experiência' : 'Explorar o Experimente+'}
                </SheetTitle>
                <SheetDescription>
                  {authenticated
                    ? 'Descubra lugares, consulte seus benefícios e gerencie sua conta.'
                    : 'Descubra lugares e serviços ou gerencie a presença do seu negócio.'}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-1 flex-col gap-2 px-4 py-5">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const active = isActivePath(url, item.href)
                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4" />
                        </span>
                        {item.label}
                      </Link>
                    </SheetClose>
                  )
                })}

                <div className="mt-auto grid gap-2 border-t pt-5">
                  {authenticated ? (
                    <>
                      <SheetClose asChild>
                        <Button variant="outline" size="lg" asChild>
                          <Link href="/carteira">
                            <TicketPercent className="size-4" />
                            Abrir carteira
                          </Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button size="lg" asChild>
                          <Link href="/portal">
                            <Store className="size-4" />
                            Portal do parceiro
                          </Link>
                        </Button>
                      </SheetClose>
                    </>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <Button variant="outline" size="lg" asChild>
                          <Link href="/login">
                            <LogIn className="size-4" />
                            Entrar
                          </Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button size="lg" asChild>
                          <Link href="/register">
                            <Store className="size-4" />
                            Criar conta
                          </Link>
                        </Button>
                      </SheetClose>
                    </>
                  )}
                </div>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

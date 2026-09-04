import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Compass,
  LogOut,
  Menu,
  Settings,
  Store,
  TicketPercent,
} from 'lucide-react'

import { AppBrand } from '~/components/app_brand'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import {
  hasNavigationCapability,
  navigationItemsForSurface,
  resolveRouteMetadata,
  SURFACE_LABELS,
  type NavigationSurface,
} from '~/config/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { useAuth } from '~/hooks/use_auth'
import { operationRoleLabel } from '~/lib/labels'
import { SidebarNav } from './sidebar'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function TenantSwitcher() {
  const { tenants, activeTenant } = useAuth()

  if (tenants.length === 0) return null

  const switchTenant = (tenantId: number) => {
    if (tenantId === activeTenant?.id) return
    router.post('/tenant/switch', { tenant_id: tenantId }, { preserveScroll: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 max-w-[230px] gap-2 rounded-md bg-background px-2.5"
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-[0.62rem] font-bold text-primary">
              {activeTenant ? initialsOf(activeTenant.name) : '—'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-start md:block">
            <span className="block truncate text-xs font-semibold">
              {activeTenant?.name ?? 'Selecionar operação'}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <span className="block text-xs font-semibold text-foreground">Operações</span>
          <span className="mt-0.5 block font-normal">Escolha a operação ativa</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onSelect={() => switchTenant(tenant.id)}
            className="gap-3 py-2"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-muted text-[0.68rem] font-semibold">
                {initialsOf(tenant.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{tenant.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {operationRoleLabel(tenant.role)}
              </span>
            </span>
            {tenant.id === activeTenant?.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({ surface }: { surface: NavigationSurface }) {
  const { user, activeTenantId, platformAccess, can } = useAuth()

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">Entrar</Link>
      </Button>
    )
  }

  const firstBackofficeDestination = navigationItemsForSurface('backoffice', 'sidebar', {
    activeTenantId,
    platformAccess,
  }).find((item) => hasNavigationCapability(item, can))
  const BackofficeIcon = firstBackofficeDestination?.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-md py-1 pe-2 ps-1 hover:bg-accent"
          aria-label="Abrir menu do usuário"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
              {initialsOf(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 min-w-0 text-start xl:block">
            <span className="block truncate text-xs font-semibold">{user.full_name}</span>
            <span className="block truncate text-[0.65rem] text-muted-foreground">Minha conta</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/10 font-bold text-primary">
              {initialsOf(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{user.full_name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cidades">
            <Compass className="size-4" />
            Explorar
          </Link>
        </DropdownMenuItem>
        {activeTenantId !== null ? (
          <DropdownMenuItem asChild>
            <Link href="/wallet">
              <TicketPercent className="size-4" />
              Carteira
            </Link>
          </DropdownMenuItem>
        ) : null}
        {activeTenantId !== null && surface !== 'portal' ? (
          <DropdownMenuItem asChild>
            <Link href="/portal">
              <Store className="size-4" />
              Portal do parceiro
            </Link>
          </DropdownMenuItem>
        ) : null}
        {firstBackofficeDestination && BackofficeIcon && surface !== 'backoffice' ? (
          <DropdownMenuItem asChild>
            <Link href={firstBackofficeDestination.href}>
              <BackofficeIcon className="size-4" />
              Operação
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Conta e preferências
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => router.post('/logout')}>
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ surface }: { surface: NavigationSurface }) {
  const { url } = usePage()
  const metadata = resolveRouteMetadata(url)
  const context = metadata
    ? { area: SURFACE_LABELS[metadata.surface], page: metadata.title }
    : { area: 'Experimente+', page: 'Área autenticada' }
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [url])

  return (
    <header className="sticky top-0 z-40 flex min-h-[72px] w-full items-center border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="app-container flex items-center gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" mode="icon" aria-label="Abrir navegação">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              closeLabel="Fechar navegação"
              className="w-[304px] gap-0 px-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navegação principal</SheetTitle>
                <SheetDescription>
                  Acesse as áreas disponíveis no{' '}
                  {SURFACE_LABELS[surface].toLocaleLowerCase('pt-BR')}.
                </SheetDescription>
              </SheetHeader>
              <div className="flex h-[72px] items-center border-b border-border/70 px-5">
                <AppBrand onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarNav surface={surface} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <AppBrand href="/" collapsed />
        </div>

        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <span className="relative flex size-2.5">
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {context.area}
            </p>
            <p className="truncate text-sm font-semibold tracking-[-0.01em]">{context.page}</p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          {surface !== 'consumer' ? <TenantSwitcher /> : null}
          <ThemeToggle />
          <UserMenu surface={surface} />
        </div>
      </div>
    </header>
  )
}

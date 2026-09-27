import { Link, usePage } from '@inertiajs/react'
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { AppBrand } from '~/components/app_brand'
import { Button } from '~/components/ui/button'
import {
  hasNavigationCapability,
  isNavigationItemActive,
  navigationItemsForSurface,
  SURFACE_LABELS,
  type NavigationItem,
  type NavigationSurface,
} from '~/config/navigation'
import { useApp } from '~/hooks/use_app'
import { useAuth } from '~/hooks/use_auth'
import { operationRoleLabel } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface NavigationSection {
  label: string
  items: NavigationItem[]
}

function initialsOf(value: string): string {
  return value
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function useCurrentUrl(): string {
  return usePage().url.split('?')[0] ?? '/'
}

export function SidebarNav({
  surface,
  collapsed = false,
  onNavigate,
}: {
  surface: NavigationSurface
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const url = useCurrentUrl()
  const application = useApp()
  const { activeTenantId, platformAccess, can } = useAuth()
  const navRef = useRef<HTMLElement>(null)

  // Every page mounts its own layout, so the list starts at the top on each visit. On a
  // 768 px-tall screen the backoffice's lower items (Pessoas e acesso, Administração)
  // would then open with their own entry out of sight: bring the current one into view.
  useEffect(() => {
    const nav = navRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current) return
    const top = current.offsetTop - nav.offsetTop
    const bottom = top + current.offsetHeight
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = Math.max(0, top - (nav.clientHeight - current.offsetHeight) / 2)
    }
  }, [url])

  const visibleItems = navigationItemsForSurface(surface, 'sidebar', {
    activeTenantId,
    platformAccess,
  }).filter((item) => {
    if (item.developmentOnly && !application.demoPagesEnabled) return false
    return hasNavigationCapability(item, can)
  })
  const visibleSections = visibleItems.reduce<NavigationSection[]>((sections, item) => {
    const section = sections.find((candidate) => candidate.label === item.section)
    if (section) section.items.push(item)
    else sections.push({ label: item.section, items: [item] })
    return sections
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label={`Navegação — ${SURFACE_LABELS[surface]}`}
      className="flex-1 overflow-y-auto px-3 py-4"
    >
      <div className="space-y-5">
        {visibleSections.map((section, sectionIndex) => (
          <section
            key={section.label}
            aria-label={collapsed ? section.label : undefined}
            aria-labelledby={collapsed ? undefined : `navigation-${sectionIndex}`}
          >
            {collapsed ? (
              sectionIndex > 0 && (
                <div aria-hidden="true" className="mx-3 mb-3 h-px bg-chrome-muted/30" />
              )
            ) : (
              <h2
                id={`navigation-${sectionIndex}`}
                className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-chrome-muted"
              >
                {section.label}
              </h2>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isNavigationItemActive(url, item, visibleItems)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-active focus-visible:ring-offset-2 focus-visible:ring-offset-chrome motion-reduce:transition-none',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-chrome-active font-bold text-chrome-active-foreground'
                        : 'font-medium text-chrome-foreground hover:bg-chrome-hover'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                        active ? 'text-chrome-active-foreground' : 'text-chrome-foreground'
                      )}
                    >
                      <Icon className="size-[1.05rem]" />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  )
}

function SidebarWorkspace({
  collapsed,
  surface,
}: {
  collapsed: boolean
  surface: NavigationSurface
}) {
  const { activeTenant } = useAuth()

  if (surface === 'consumer') return null

  if (!activeTenant) {
    return (
      <div
        className={cn('border-t border-chrome-muted/25 p-3', collapsed && 'flex justify-center')}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-chrome-hover p-3 text-chrome-muted',
            collapsed && 'size-10 justify-center p-0'
          )}
          title={collapsed ? 'Nenhuma operação ativa' : undefined}
        >
          <ShieldCheck className="size-4 shrink-0" />
          {!collapsed && <span className="text-xs font-medium">Nenhuma operação ativa</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('border-t border-chrome-muted/25 p-3', collapsed && 'flex justify-center')}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-3 rounded-xl bg-chrome-hover p-3 text-chrome-foreground',
          collapsed && 'size-10 justify-center p-0'
        )}
        title={collapsed ? activeTenant.name : undefined}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chrome-active text-xs font-extrabold text-chrome-active-foreground">
          {initialsOf(activeTenant.name)}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold">{activeTenant.name}</span>
            <span className="block truncate text-[0.68rem] text-chrome-muted">
              {operationRoleLabel(activeTenant.role)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

interface SidebarProps {
  surface: NavigationSurface
  isCollapsed?: boolean
  onToggle: () => void
}

export function Sidebar({ surface, isCollapsed = false, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-50 hidden bg-chrome text-chrome-foreground transition-[width] duration-300 motion-reduce:transition-none lg:flex lg:flex-col',
        isCollapsed ? 'w-[84px]' : 'w-[272px]'
      )}
    >
      <div
        className={cn(
          'relative flex h-[72px] shrink-0 items-center border-b border-chrome-muted/25 px-5',
          isCollapsed && 'justify-center px-0'
        )}
      >
        <AppBrand href="/" collapsed={isCollapsed} tone="inverse" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          mode="icon"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expandir navegação' : 'Recolher navegação'}
          className="absolute -end-3.5 top-1/2 size-7 -translate-y-1/2 rounded-md bg-background"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </Button>
      </div>

      <SidebarNav surface={surface} collapsed={isCollapsed} />
      <SidebarWorkspace surface={surface} collapsed={isCollapsed} />
    </aside>
  )
}

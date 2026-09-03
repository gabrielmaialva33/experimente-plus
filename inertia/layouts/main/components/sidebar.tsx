import { Link, usePage } from '@inertiajs/react'
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react'

import { AppBrand } from '~/components/app_brand'
import { Button } from '~/components/ui/button'
import { isNavigationItemActive, NAVIGATION_ITEMS, type NavigationItem } from '~/config/navigation'
import { useApp } from '~/hooks/use_app'
import { useAuth } from '~/hooks/use_auth'
import { organizationRoleLabel } from '~/lib/labels'
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
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const url = useCurrentUrl()
  const application = useApp()
  const { can } = useAuth()

  const visibleItems = NAVIGATION_ITEMS.filter((item) => {
    if (!item.placements.includes('sidebar')) return false
    if (item.developmentOnly && !application.demoPagesEnabled) return false
    return !item.capability || can(item.capability)
  })
  const visibleSections = visibleItems.reduce<NavigationSection[]>((sections, item) => {
    const section = sections.find((candidate) => candidate.label === item.section)
    if (section) section.items.push(item)
    else sections.push({ label: item.section, items: [item] })
    return sections
  }, [])

  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-5">
        {visibleSections.map((section, sectionIndex) => (
          <section
            key={section.label}
            aria-label={collapsed ? section.label : undefined}
            aria-labelledby={collapsed ? undefined : `navigation-${sectionIndex}`}
          >
            {collapsed ? (
              sectionIndex > 0 && <div aria-hidden="true" className="mx-3 mb-3 h-px bg-border/70" />
            ) : (
              <h2
                id={`navigation-${sectionIndex}`}
                className="mb-1.5 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75"
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
                      'group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-primary/10 text-primary shadow-xs ring-1 ring-primary/10'
                        : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                    )}
                  >
                    {active && (
                      <span className="absolute start-0 h-5 w-0.5 rounded-e-full bg-primary" />
                    )}
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
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

function SidebarWorkspace({ collapsed }: { collapsed: boolean }) {
  const { activeTenant } = useAuth()

  if (!activeTenant) {
    return (
      <div className={cn('border-t border-border/70 p-3', collapsed && 'flex justify-center')}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-muted/70 p-3 text-muted-foreground',
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
    <div className={cn('border-t border-border/70 p-3', collapsed && 'flex justify-center')}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3 shadow-xs',
          collapsed && 'size-10 justify-center p-0'
        )}
        title={collapsed ? activeTenant.name : undefined}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {initialsOf(activeTenant.name)}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">{activeTenant.name}</span>
            <span className="block truncate text-[0.68rem] text-muted-foreground">
              {organizationRoleLabel(activeTenant.role)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

interface SidebarProps {
  isCollapsed?: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-50 hidden border-e border-border/70 bg-card/95 shadow-[4px_0_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-[width] duration-300 lg:flex lg:flex-col',
        isCollapsed ? 'w-[84px]' : 'w-[272px]'
      )}
    >
      <div
        className={cn(
          'relative flex h-[72px] shrink-0 items-center border-b border-border/70 px-5',
          isCollapsed && 'justify-center px-0'
        )}
      >
        <AppBrand href="/" collapsed={isCollapsed} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          mode="icon"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expandir navegação' : 'Recolher navegação'}
          className="absolute -end-3.5 top-1/2 size-7 -translate-y-1/2 rounded-full bg-background shadow-sm"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </Button>
      </div>

      <SidebarNav collapsed={isCollapsed} />
      <SidebarWorkspace collapsed={isCollapsed} />
    </aside>
  )
}

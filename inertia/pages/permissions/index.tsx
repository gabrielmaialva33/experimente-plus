import { Head } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { ChevronDown, KeyRound, Search } from 'lucide-react'

import { MainLayout } from '~/layouts'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { EmptyState } from '~/components/empty_state'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/page_header'
import {
  permissionActionLabel,
  permissionContextLabel,
  permissionResourceLabel,
} from '~/lib/labels'

interface PermissionRow {
  id: number
  name: string
  resource: string
  action: string
  context: string
  description: string | null
}

interface PermissionsPageProps {
  permissions: PermissionRow[]
}

const ACTION_BADGE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  create: 'success',
  read: 'info',
  list: 'info',
  update: 'warning',
  delete: 'destructive',
  assign: 'secondary',
  revoke: 'secondary',
  export: 'secondary',
  import: 'secondary',
}

function groupByResource(permissions: PermissionRow[]): [string, PermissionRow[]][] {
  const groups = new Map<string, PermissionRow[]>()
  for (const permission of permissions) {
    const bucket = groups.get(permission.resource) ?? []
    bucket.push(permission)
    groups.set(permission.resource, bucket)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

export default function PermissionsPage({ permissions }: PermissionsPageProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return permissions
    return permissions.filter((permission) =>
      [permission.name, permission.resource, permission.action, permission.context]
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [permissions, search])

  const grouped = useMemo(() => groupByResource(filtered), [filtered])
  // Collapsed by area (audit W41); a search opens every area it matched.
  const searching = search.trim() !== ''

  return (
    <MainLayout>
      <Head title="Permissões" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Pessoas e acesso"
          icon={KeyRound}
          title="Permissões"
          description="Capacidades globais agrupadas por recurso. As regras do domínio continuam limitando cada organização e unidade."
        />

        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Buscar permissões"
            aria-label="Buscar permissões"
            className="w-full ps-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {grouped.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={KeyRound}
                title="Nenhuma permissão encontrada"
                description="Tente outro termo de busca."
              />
            </CardContent>
          </Card>
        ) : (
          <section
            aria-label="Permissões por área"
            className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-card"
          >
            {grouped.map(([resource, items]) => (
              <details
                key={resource + (searching ? ':search' : '')}
                open={searching || undefined}
                className="group"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                      <KeyRound aria-hidden="true" className="size-4" />
                    </span>
                    {/* Wraps on a phone: a clipped area name ("Acessos a ediç…") hides which one it is. */}
                    <span className="min-w-0 font-display font-extrabold leading-snug">
                      {permissionResourceLabel(resource)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" appearance="light" shape="pill">
                      {items.length} {items.length === 1 ? 'permissão' : 'permissões'}
                    </Badge>
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </span>
                </summary>
                <ul className="flex flex-wrap gap-2 px-5 pb-5 sm:ps-17">
                  {items.map((permission) => (
                    <li key={permission.id}>
                      <Badge
                        variant={ACTION_BADGE[permission.action] ?? 'secondary'}
                        appearance="light"
                        shape="pill"
                      >
                        {permissionActionLabel(permission.action)}
                        {permission.context !== 'any'
                          ? ' · ' + permissionContextLabel(permission.context)
                          : null}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        )}
      </div>
    </MainLayout>
  )
}

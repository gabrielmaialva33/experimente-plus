import { Head } from '@inertiajs/react'
import { useMemo } from 'react'
import { ChevronDown, ShieldCheck, Users } from 'lucide-react'

import { MainLayout } from '~/layouts'
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import {
  globalRoleDescription,
  globalRoleLabel,
  permissionActionLabel,
  permissionContextLabel,
  permissionResourceLabel,
} from '~/lib/labels'

interface RolePermission {
  id: number
  name: string
  resource: string
  action: string
  context: string
}

interface RoleRow {
  id: number
  name: string
  slug: string
  description: string | null
  users_count: number
  permissions: RolePermission[]
}

interface RolesPageProps {
  roles: RoleRow[]
}

const SLUG_BADGE: Record<string, 'primary' | 'destructive' | 'info' | 'success' | 'secondary'> = {
  root: 'destructive',
  admin: 'primary',
  moderator: 'info',
  user: 'success',
  guest: 'secondary',
}

function groupByResource(permissions: RolePermission[]): [string, RolePermission[]][] {
  const groups = new Map<string, RolePermission[]>()
  for (const permission of permissions) {
    const bucket = groups.get(permission.resource) ?? []
    bucket.push(permission)
    groups.set(permission.resource, bucket)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function RoleCard({ role }: { role: RoleRow }) {
  const grouped = useMemo(() => groupByResource(role.permissions), [role.permissions])

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
              <ShieldCheck aria-hidden="true" className="size-4.5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
                {globalRoleLabel(role.slug, role.name)}
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {globalRoleDescription(role.slug)}
              </p>
            </div>
          </div>
        </CardHeading>
        <CardToolbar>
          <Badge variant="secondary" appearance="light" shape="pill">
            <Users aria-hidden="true" />
            {role.users_count} {role.users_count === 1 ? 'pessoa' : 'pessoas'}
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent>
        {role.permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma permissão atribuída.</p>
        ) : (
          // The matrix is reference material, not what a person scans for;
          // it opens on request (audit W57).
          <details className="group rounded-xl bg-background">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span>
                {role.permissions.length}{' '}
                {role.permissions.length === 1 ? 'permissão' : 'permissões'} em {grouped.length}{' '}
                {grouped.length === 1 ? 'área' : 'áreas'}
              </span>
              <span className="inline-flex items-center gap-1 text-primary-accent">
                <span className="group-open:hidden">Ver permissões</span>
                <span className="hidden group-open:inline">Recolher</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              {grouped.map(([resource, permissions]) => (
                <div key={resource}>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {permissionResourceLabel(resource)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {permissions.map((permission) => (
                      <Badge
                        key={permission.id}
                        variant={SLUG_BADGE[role.slug] ?? 'secondary'}
                        appearance="light"
                        size="sm"
                      >
                        {permissionActionLabel(permission.action)}
                        {permission.context !== 'any' && (
                          <span className="opacity-75">
                            {' '}
                            · {permissionContextLabel(permission.context)}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export default function RolesPage({ roles }: RolesPageProps) {
  return (
    <MainLayout>
      <Head title="Papéis" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Pessoas e acesso"
          icon={ShieldCheck}
          title="Papéis"
          description="Papéis agrupam capacidades da plataforma. O acesso a organizações continua dependendo do vínculo e das regras de domínio."
        />

        {roles.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={ShieldCheck}
                title="Nenhum papel encontrado"
                description="Ainda não há papéis globais configurados."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}

import { Head } from '@inertiajs/react'
import { useMemo } from 'react'
import { ShieldCheck, Users } from 'lucide-react'

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
  editor: 'secondary',
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4.5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                {globalRoleLabel(role.slug, role.name)}
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {globalRoleDescription(role.slug)}
              </p>
            </div>
          </div>
        </CardHeading>
        <CardToolbar>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>{role.users_count}</span>
          </div>
        </CardToolbar>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Permissões atribuídas</p>
          <Badge variant={SLUG_BADGE[role.slug] ?? 'secondary'} appearance="light" size="sm">
            {role.permissions.length}
          </Badge>
        </div>

        {role.permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma permissão atribuída.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([resource, permissions]) => (
              <div key={resource}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {permissionResourceLabel(resource)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {permissions.map((permission) => (
                    <Badge key={permission.id} variant="info" appearance="outline" size="sm">
                      {permissionActionLabel(permission.action)}
                      {permission.context !== 'any' && (
                        <span className="text-muted-foreground">
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
          eyebrow="Administração global"
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

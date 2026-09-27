import { Head, Link } from '@inertiajs/react'
import { ArrowRight, Building2 } from 'lucide-react'

import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { MainLayout } from '~/layouts/main_layout'
import { organizationRoleLabel, organizationStatusLabel } from '~/lib/labels'

interface OrganizationTeamChooserProps {
  organizations: {
    id: number
    trade_name: string
    status: string
    role: string | null
    can_manage: boolean
  }[]
}

/** "Equipe" when the viewer reaches the team of more than one organization. */
export default function OrganizationTeamChooserPage({
  organizations,
}: OrganizationTeamChooserProps) {
  return (
    <MainLayout>
      <Head title="Equipe" />

      <div className="space-y-6">
        <PageHeader
          title="Equipe"
          description="Cada organização tem a própria equipe. Escolha qual deseja ver ou gerenciar."
        />

        <ul className="grid gap-4 lg:grid-cols-2">
          {organizations.map((organization) => (
            <li key={organization.id}>
              <Link
                href={`/portal/organizations/${organization.id}/team`}
                className="group flex h-full flex-col rounded-card border border-border-subtle bg-card p-5 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                <span className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em]">
                  <Building2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{organization.trade_name}</span>
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" appearance="light" shape="pill" size="md">
                    {organizationRoleLabel(organization.role)}
                  </Badge>
                  <Badge variant="neutral" appearance="light" shape="pill" size="md">
                    {organizationStatusLabel(organization.status)}
                  </Badge>
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                  {organization.can_manage ? 'Gerenciar equipe' : 'Ver equipe'}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MainLayout>
  )
}

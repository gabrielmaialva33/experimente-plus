import { Head, Link } from '@inertiajs/react'
import { ArrowRight, BarChart3, MapPin, TicketPercent } from 'lucide-react'

import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { PLACE_STATE, type PlaceState } from '~/lib/partner_places'

type PartnerPlacesPageProps = {
  organizations: {
    id: number
    name: string
    can_read_analytics: boolean
    places: {
      id: number
      name: string
      state: PlaceState
      can_list_benefits: boolean
    }[]
  }[]
}

/** "Dados do lugar", when a partner has more than one place to choose from. */
export default function PartnerPlacesPage({ organizations }: PartnerPlacesPageProps) {
  return (
    <MainLayout>
      <Head title="Dados do lugar" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={MapPin}
          title="Dados do lugar"
          description="Escolha o lugar para editar horários, fotos, contato e endereço."
        />

        {organizations.map((organization) => (
          <section
            key={organization.id}
            aria-labelledby={`organization-${organization.id}`}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`organization-${organization.id}`} className="text-lg font-bold">
                {organization.name}
              </h2>
              {organization.can_read_analytics ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/organizations/${organization.id}/analytics`}>
                    <BarChart3 aria-hidden="true" className="size-4" />
                    Desempenho
                  </Link>
                </Button>
              ) : null}
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {organization.places.map((place) => (
                <li key={place.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{place.name}</p>
                  </div>
                  <Badge variant={PLACE_STATE[place.state].variant} appearance="light">
                    {PLACE_STATE[place.state].label}
                  </Badge>
                  {place.can_list_benefits ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/portal/establishments/${place.id}/benefits`}>
                        <TicketPercent aria-hidden="true" className="size-4" />
                        Benefícios
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/portal/establishments/${place.id}`}>
                      Editar dados
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </MainLayout>
  )
}

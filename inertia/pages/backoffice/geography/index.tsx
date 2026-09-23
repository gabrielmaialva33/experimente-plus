import { Head } from '@inertiajs/react'
import { Map as MapIcon, MapPinned } from 'lucide-react'

import { ResourceSection } from '~/components/backoffice/resource_section'
import { PageHeader } from '~/components/page_header'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { collection, numeric, text, type JsonRecord } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'

interface GeographyPageProps {
  regions: unknown
  cities: unknown
}

const regionFields: FieldSpec[] = [
  { name: 'name', label: 'Nome', type: 'text', required: true },
  {
    name: 'slug',
    label: 'Slug',
    type: 'text',
    omitWhenBlank: true,
    hint: 'Em branco, é gerado a partir do nome',
  },
  { name: 'description', label: 'Descrição', type: 'textarea', nullable: true },
  { name: 'sort_order', label: 'Ordem', type: 'number', defaultValue: '0', step: '1' },
]

export default function BackofficeGeography({ regions, cities }: GeographyPageProps) {
  const { can } = useAuth()
  const regionRows = collection(regions)
  const cityRows = collection(cities)
  const regionName = new Map(regionRows.map((row) => [numeric(row, 'id'), text(row, 'name')]))

  const cityFields: FieldSpec[] = [
    {
      name: 'region_id',
      label: 'Região',
      type: 'select',
      numeric: true,
      required: true,
      defaultValue: regionRows[0] ? String(numeric(regionRows[0], 'id')) : '',
      options: regionRows.map((row) => ({
        value: String(numeric(row, 'id')),
        label: text(row, 'name'),
      })),
    },
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      omitWhenBlank: true,
      hint: 'Em branco, é gerado a partir do nome',
    },
    { name: 'state_code', label: 'UF', type: 'text', required: true, defaultValue: 'PR' },
    {
      name: 'timezone',
      label: 'Fuso horário',
      type: 'text',
      omitWhenBlank: true,
      defaultValue: 'America/Sao_Paulo',
      // The timezone decides when an event is "today" in this city (ADR-0028),
      // not the visitor's device and not the server.
      hint: 'Decide o que é "hoje" na agenda desta cidade',
    },
    {
      name: 'ibge_code',
      label: 'Código IBGE',
      type: 'text',
      nullable: true,
      hint: 'Sete dígitos',
    },
    { name: 'latitude', label: 'Latitude', type: 'number', nullable: true, step: 'any' },
    { name: 'longitude', label: 'Longitude', type: 'number', nullable: true, step: 'any' },
    { name: 'sort_order', label: 'Ordem', type: 'number', defaultValue: '0', step: '1' },
  ]

  const describeRegion = (row: JsonRecord) => ({
    name: text(row, 'name'),
    meta: text(row, 'slug'),
  })

  const describeCity = (row: JsonRecord) => ({
    name: `${text(row, 'name')} · ${text(row, 'state_code')}`,
    meta: [regionName.get(numeric(row, 'region_id')), text(row, 'timezone'), text(row, 'slug')]
      .filter(Boolean)
      .join(' · '),
  })

  return (
    <MainLayout>
      <Head title="Regiões e cidades" />
      <div className="space-y-7">
        <PageHeader
          eyebrow="Administração"
          icon={MapPinned}
          title="Regiões e cidades"
          description="Onde a operação atua. Desativar uma cidade a tira da descoberta pública sem apagar o que existe nela."
        />

        <ResourceSection
          id="regions"
          title="Regiões"
          description="Agrupamentos de cidades, como Norte do Paraná."
          icon={MapIcon}
          records={regionRows}
          fields={regionFields}
          basePath="/backoffice/geography/regions"
          createLabel="Nova região"
          emptyLabel="Nenhuma região cadastrada"
          describe={describeRegion}
          canCreate={can('regions.create')}
          canUpdate={can('regions.update')}
        />

        <ResourceSection
          id="cities"
          title="Cidades"
          description="Cada cidade tem o próprio fuso, que é o que decide a agenda do dia."
          icon={MapPinned}
          records={cityRows}
          fields={cityFields}
          basePath="/backoffice/geography/cities"
          createLabel="Nova cidade"
          emptyLabel="Nenhuma cidade cadastrada"
          describe={describeCity}
          canCreate={can('cities.create') && regionRows.length > 0}
          canUpdate={can('cities.update')}
        />
      </div>
    </MainLayout>
  )
}

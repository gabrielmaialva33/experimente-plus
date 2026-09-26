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

/**
 * Brazilian time zones by the name people use (audit W63), stored as the IANA
 * identifier the server keeps. A stored zone outside the list stays selectable
 * under its own identifier, so editing a city never changes it by accident.
 */
const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Sao_Paulo', label: 'Horário de Brasília' },
  { value: 'America/Manaus', label: 'Horário do Amazonas (−1h)' },
  { value: 'America/Rio_Branco', label: 'Horário do Acre (−2h)' },
  { value: 'America/Noronha', label: 'Horário de Fernando de Noronha (+1h)' },
]

export function timezoneLabel(value: string): string {
  return TIMEZONES.find((zone) => zone.value === value)?.label ?? value
}

function timezoneOptions(cities: JsonRecord[]) {
  const stored = cities
    .map((city) => text(city, 'timezone'))
    .filter((zone) => zone && !TIMEZONES.some((known) => known.value === zone))
  return [...TIMEZONES, ...[...new Set(stored)].map((zone) => ({ value: zone, label: zone }))]
}

const regionFields: FieldSpec[] = [
  { name: 'name', label: 'Nome', type: 'text', required: true },
  {
    name: 'slug',
    label: 'Slug',
    type: 'text',
    omitWhenBlank: true,
    hint: 'Em branco, é gerado a partir do nome',
    advanced: true,
  },
  { name: 'description', label: 'Descrição', type: 'textarea', nullable: true },
  {
    name: 'sort_order',
    label: 'Ordem',
    type: 'number',
    defaultValue: '0',
    step: '1',
    advanced: true,
  },
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
      advanced: true,
    },
    { name: 'state_code', label: 'UF', type: 'text', required: true, defaultValue: 'PR' },
    {
      name: 'timezone',
      label: 'Fuso horário',
      type: 'select',
      required: true,
      defaultValue: 'America/Sao_Paulo',
      options: timezoneOptions(cityRows),
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
      advanced: true,
    },
    {
      name: 'latitude',
      label: 'Latitude',
      type: 'number',
      nullable: true,
      step: 'any',
      advanced: true,
    },
    {
      name: 'longitude',
      label: 'Longitude',
      type: 'number',
      nullable: true,
      step: 'any',
      advanced: true,
    },
    {
      name: 'sort_order',
      label: 'Ordem',
      type: 'number',
      defaultValue: '0',
      step: '1',
      advanced: true,
    },
  ]

  const describeRegion = (row: JsonRecord) => ({
    name: text(row, 'name'),
    meta: text(row, 'description'),
  })

  const describeCity = (row: JsonRecord) => ({
    name: `${text(row, 'name')} · ${text(row, 'state_code')}`,
    meta: [regionName.get(numeric(row, 'region_id')), timezoneLabel(text(row, 'timezone'))]
      .filter(Boolean)
      .join(' · '),
  })

  return (
    <MainLayout>
      <Head title="Regiões e cidades" />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administração · catálogo"
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
          deactivateEffect="As unidades de todas as cidades desta região saem da descoberta até a região ser reativada. Nada é apagado."
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
          deactivateEffect="As unidades desta cidade saem da descoberta até a cidade ser reativada. Nada é apagado."
          canCreate={can('cities.create') && regionRows.length > 0}
          canUpdate={can('cities.update')}
        />
      </div>
    </MainLayout>
  )
}

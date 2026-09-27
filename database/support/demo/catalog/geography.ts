/**
 * Real cities of the north of Paraná, with their IBGE codes and the coordinates
 * of their central area. Only the geography is real: every business placed in
 * these cities by the demo catalogue is fictitious.
 */

export interface DemoRegion {
  slug: string
  name: string
  description: string
  sort_order: number
}

export interface DemoCity {
  slug: string
  name: string
  region_slug: string
  ibge_code: string
  latitude: number
  longitude: number
  sort_order: number
  /**
   * Neighbourhood names for the fictitious addresses ("Endereço demonstrativo"). The
   * larger cities use well-known districts; smaller ones use common generic names.
   */
  districts: string[]
  /** How far, in kilometres, places may spread from the centre on the map. */
  spread_km: number
}

export const DEMO_REGIONS: DemoRegion[] = [
  {
    slug: 'norte-do-parana',
    name: 'Norte do Paraná',
    description:
      'Praça demonstrativa centrada em Londrina, com experiências urbanas, gastronomia, café, cultura e lazer.',
    sort_order: 0,
  },
  {
    slug: 'norte-pioneiro',
    name: 'Norte Pioneiro',
    description:
      'Praça demonstrativa de cidades do Norte Pioneiro, com negócios locais, rotas regionais e experiências de bairro.',
    sort_order: 10,
  },
]

export const DEMO_CITIES: DemoCity[] = [
  {
    slug: 'londrina',
    name: 'Londrina',
    region_slug: 'norte-do-parana',
    ibge_code: '4113700',
    latitude: -23.3045,
    longitude: -51.1696,
    sort_order: 0,
    districts: [
      'Centro',
      'Gleba Palhano',
      'Higienópolis',
      'Vila Nova',
      'Jardim Quebec',
      'Bela Suíça',
      'Vila Ipiranga',
      'Aeroporto',
    ],
    spread_km: 3.2,
  },
  {
    slug: 'maringa',
    name: 'Maringá',
    region_slug: 'norte-do-parana',
    ibge_code: '4115200',
    latitude: -23.4205,
    longitude: -51.9333,
    sort_order: 1,
    districts: [
      'Zona 01',
      'Zona 02',
      'Zona 05',
      'Zona 07',
      'Novo Centro',
      'Vila Operária',
      'Jardim Alvorada',
      'Jardim Universitário',
    ],
    spread_km: 3,
  },
  {
    slug: 'apucarana',
    name: 'Apucarana',
    region_slug: 'norte-do-parana',
    ibge_code: '4101408',
    latitude: -23.5508,
    longitude: -51.4608,
    sort_order: 2,
    districts: ['Centro', 'Vila Nova', 'Jardim América', 'Jardim Primavera'],
    spread_km: 1.8,
  },
  {
    slug: 'arapongas',
    name: 'Arapongas',
    region_slug: 'norte-do-parana',
    ibge_code: '4101507',
    latitude: -23.4153,
    longitude: -51.4259,
    sort_order: 3,
    districts: ['Centro', 'Jardim Tropical', 'Vila Nova', 'Jardim Primavera'],
    spread_km: 1.8,
  },
  {
    slug: 'cambe',
    name: 'Cambé',
    region_slug: 'norte-do-parana',
    ibge_code: '4103701',
    latitude: -23.2766,
    longitude: -51.2798,
    sort_order: 4,
    districts: ['Centro', 'Vila Nova', 'Jardim América', 'Jardim Primavera'],
    spread_km: 1.6,
  },
  {
    slug: 'rolandia',
    name: 'Rolândia',
    region_slug: 'norte-do-parana',
    ibge_code: '4122404',
    latitude: -23.3101,
    longitude: -51.3659,
    sort_order: 5,
    districts: ['Centro', 'Jardim Novo Horizonte', 'Vila Nova', 'Jardim Europa'],
    spread_km: 1.6,
  },
  {
    slug: 'ibipora',
    name: 'Ibiporã',
    region_slug: 'norte-do-parana',
    ibge_code: '4109807',
    latitude: -23.2659,
    longitude: -51.0522,
    sort_order: 6,
    districts: ['Centro', 'Vila Nova', 'Jardim Primavera', 'Jardim América'],
    spread_km: 1.5,
  },
  {
    slug: 'cornelio-procopio',
    name: 'Cornélio Procópio',
    region_slug: 'norte-pioneiro',
    ibge_code: '4106407',
    latitude: -23.1813,
    longitude: -50.6463,
    sort_order: 10,
    districts: ['Centro', 'Vila Nova', 'Jardim Europa', 'Jardim América'],
    spread_km: 1.5,
  },
  {
    slug: 'bandeirantes',
    name: 'Bandeirantes',
    region_slug: 'norte-pioneiro',
    ibge_code: '4102406',
    latitude: -23.1078,
    longitude: -50.3671,
    sort_order: 20,
    districts: ['Centro', 'Vila Maria', 'Jardim Europa'],
    spread_km: 1.3,
  },
]

export function demoCity(slug: string): DemoCity {
  const city = DEMO_CITIES.find((candidate) => candidate.slug === slug)
  if (!city) throw new Error(`Unknown demo city ${slug}`)
  return city
}

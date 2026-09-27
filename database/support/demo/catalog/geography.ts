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
  /**
   * Approximate centre of a district, where its places are pinned so the
   * address and the map agree. Districts without one spread around the city.
   */
  anchors?: Record<string, readonly [number, number]>
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
      'Vila Nova',
      'Gleba Palhano',
      'Aeroporto',
      'Vila Casoni',
      'Jardim Canadá',
      'Vila Brasil',
      'Jardim Alpes',
      'Presidente',
    ],
    spread_km: 3.2,
    anchors: {
      'Centro': [-23.3103, -51.1628],
      'Vila Nova': [-23.297, -51.1673],
      'Gleba Palhano': [-23.3296, -51.1855],
      'Aeroporto': [-23.3312, -51.1307],
      'Vila Casoni': [-23.298, -51.1458],
      'Jardim Canadá': [-23.3184, -51.1681],
      'Vila Brasil': [-23.3276, -51.1503],
      'Jardim Alpes': [-23.2829, -51.1639],
      'Presidente': [-23.3115, -51.1804],
    },
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
    spread_km: 1.5,
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
    spread_km: 1.5,
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
    spread_km: 1.3,
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
    spread_km: 1.3,
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
    spread_km: 1.2,
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
    spread_km: 1.2,
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
    spread_km: 1,
  },
]

export function demoCity(slug: string): DemoCity {
  const city = DEMO_CITIES.find((candidate) => candidate.slug === slug)
  if (!city) throw new Error(`Unknown demo city ${slug}`)
  return city
}

import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import Category from '#modules/taxonomy/models/category'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import type Tenant from '#modules/tenants/models/tenant'

export const DEVELOPMENT_DATA_NOTICE =
  'Cidades e códigos geográficos usam referências públicas. Organizações, estabelecimentos, endereços, contatos, imagens, ofertas e resgates são inteiramente fictícios e existem apenas para desenvolvimento e demonstração.'

interface RegionDefinition {
  name: string
  slug: string
  description: string
  sort_order: number
}

interface CityDefinition {
  name: string
  slug: string
  region_slug: string
  ibge_code: string
  latitude: number
  longitude: number
  sort_order: number
}

interface FamilyDefinition {
  name: string
  slug: string
  description: string
  icon: string
  sort_order: number
}

interface CategoryDefinition {
  name: string
  slug: string
  family_slug: string
  description: string
  icon: string
  sort_order: number
  allows_always_open?: boolean
}

export const DEVELOPMENT_REGIONS: RegionDefinition[] = [
  {
    name: 'Norte do Paraná',
    slug: 'norte-do-parana',
    description:
      'Praça demonstrativa centrada em Londrina, com experiências urbanas, gastronomia, café, cultura e lazer.',
    sort_order: 0,
  },
  {
    name: 'Norte Pioneiro',
    slug: 'norte-pioneiro',
    description:
      'Praça demonstrativa de cidades do Norte Pioneiro, com negócios locais, rotas regionais e experiências de bairro.',
    sort_order: 10,
  },
]

export const DEVELOPMENT_CITIES: CityDefinition[] = [
  {
    name: 'Londrina',
    slug: 'londrina',
    region_slug: 'norte-do-parana',
    ibge_code: '4113700',
    latitude: -23.3045,
    longitude: -51.1696,
    sort_order: 0,
  },
  {
    name: 'Cornélio Procópio',
    slug: 'cornelio-procopio',
    region_slug: 'norte-pioneiro',
    ibge_code: '4106407',
    latitude: -23.1813,
    longitude: -50.6463,
    sort_order: 10,
  },
  {
    name: 'Bandeirantes',
    slug: 'bandeirantes',
    region_slug: 'norte-pioneiro',
    ibge_code: '4102406',
    latitude: -23.1078,
    longitude: -50.3671,
    sort_order: 20,
  },
]

export const DEVELOPMENT_FAMILIES: FamilyDefinition[] = [
  {
    name: 'Comer & Beber',
    slug: 'comer-e-beber',
    description: 'Restaurantes, cafés, bares, padarias e outras experiências gastronômicas.',
    icon: 'utensils',
    sort_order: 0,
  },
  {
    name: 'Cultura & Lazer',
    slug: 'cultura-e-lazer',
    description: 'Cinema, eventos, arte e experiências culturais para aproveitar a cidade.',
    icon: 'ticket',
    sort_order: 10,
  },
  {
    name: 'Bem-estar & Estilo',
    slug: 'bem-estar-e-estilo',
    description: 'Cuidados pessoais, beleza, tatuagem e experiências de bem-estar.',
    icon: 'sparkles',
    sort_order: 20,
  },
]

export const DEVELOPMENT_CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Restaurantes',
    slug: 'restaurantes',
    family_slug: 'comer-e-beber',
    description: 'Casas com serviço de refeições e experiências completas à mesa.',
    icon: 'utensils',
    sort_order: 0,
  },
  {
    name: 'Bares',
    slug: 'bares',
    family_slug: 'comer-e-beber',
    description: 'Bares, gastrobares, petiscos e programação noturna.',
    icon: 'glass-water',
    sort_order: 10,
  },
  {
    name: 'Cafés',
    slug: 'cafes',
    family_slug: 'comer-e-beber',
    description: 'Cafeterias, cafés especiais, brunch e encontros durante o dia.',
    icon: 'coffee',
    sort_order: 20,
  },
  {
    name: 'Padarias',
    slug: 'padarias',
    family_slug: 'comer-e-beber',
    description: 'Panificação, confeitaria, café da manhã e produtos artesanais.',
    icon: 'croissant',
    sort_order: 30,
  },
  {
    name: 'Docerias',
    slug: 'docerias',
    family_slug: 'comer-e-beber',
    description: 'Doces, sobremesas, bolos e presentes gastronômicos.',
    icon: 'cake-slice',
    sort_order: 40,
  },
  {
    name: 'Hamburguerias',
    slug: 'hamburguerias',
    family_slug: 'comer-e-beber',
    description: 'Hambúrgueres artesanais, acompanhamentos e menus descontraídos.',
    icon: 'sandwich',
    sort_order: 50,
  },
  {
    name: 'Pizzarias',
    slug: 'pizzarias',
    family_slug: 'comer-e-beber',
    description: 'Pizzas artesanais, tradicionais e contemporâneas.',
    icon: 'pizza',
    sort_order: 60,
  },
  {
    name: 'Cozinha japonesa',
    slug: 'cozinha-japonesa',
    family_slug: 'comer-e-beber',
    description: 'Sushi, pratos quentes e experiências inspiradas na culinária japonesa.',
    icon: 'fish',
    sort_order: 70,
  },
  {
    name: 'Cinema & Audiovisual',
    slug: 'cinema-e-audiovisual',
    family_slug: 'cultura-e-lazer',
    description: 'Salas, cineclubes, mostras e experiências audiovisuais.',
    icon: 'clapperboard',
    sort_order: 0,
  },
  {
    name: 'Cultura & Eventos',
    slug: 'cultura-e-eventos',
    family_slug: 'cultura-e-lazer',
    description: 'Casas culturais, oficinas, exposições, música e eventos independentes.',
    icon: 'music',
    sort_order: 10,
  },
  {
    name: 'Estúdios de tatuagem',
    slug: 'estudios-de-tatuagem',
    family_slug: 'bem-estar-e-estilo',
    description: 'Estúdios, artistas e experiências de arte corporal com atendimento agendado.',
    icon: 'pen-tool',
    sort_order: 0,
  },
  {
    name: 'Beleza & Bem-estar',
    slug: 'beleza-e-bem-estar',
    family_slug: 'bem-estar-e-estilo',
    description: 'Autocuidado, terapias, beleza e experiências para desacelerar.',
    icon: 'flower-2',
    sort_order: 10,
  },
]

export interface DevelopmentCatalogResult {
  regions: Map<string, Region>
  cities: Map<string, City>
  families: Map<string, CategoryFamily>
  categories: Map<string, Category>
}

export async function seedDevelopmentCatalog(tenant: Tenant): Promise<DevelopmentCatalogResult> {
  const regions = new Map<string, Region>()
  for (const definition of DEVELOPMENT_REGIONS) {
    const region = await Region.updateOrCreate(
      { tenant_id: tenant.id, slug: definition.slug },
      {
        tenant_id: tenant.id,
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        sort_order: definition.sort_order,
        is_active: true,
      }
    )
    regions.set(definition.slug, region)
  }

  const cities = new Map<string, City>()
  for (const definition of DEVELOPMENT_CITIES) {
    const region = regions.get(definition.region_slug)
    if (!region) {
      throw new Error(`Development region ${definition.region_slug} is missing`)
    }

    const city = await City.updateOrCreate(
      { tenant_id: tenant.id, slug: definition.slug },
      {
        tenant_id: tenant.id,
        region_id: region.id,
        name: definition.name,
        slug: definition.slug,
        state_code: 'PR',
        country_code: 'BR',
        ibge_code: definition.ibge_code,
        timezone: 'America/Sao_Paulo',
        latitude: definition.latitude,
        longitude: definition.longitude,
        sort_order: definition.sort_order,
        is_active: true,
      }
    )
    cities.set(definition.slug, city)
  }

  const families = new Map<string, CategoryFamily>()
  for (const definition of DEVELOPMENT_FAMILIES) {
    const family = await CategoryFamily.updateOrCreate(
      { tenant_id: tenant.id, slug: definition.slug },
      {
        tenant_id: tenant.id,
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        icon: definition.icon,
        sort_order: definition.sort_order,
        is_active: true,
      }
    )
    families.set(definition.slug, family)
  }

  const categories = new Map<string, Category>()
  for (const definition of DEVELOPMENT_CATEGORIES) {
    const family = families.get(definition.family_slug)
    if (!family) {
      throw new Error(`Development category family ${definition.family_slug} is missing`)
    }

    const category = await Category.updateOrCreate(
      { tenant_id: tenant.id, slug: definition.slug },
      {
        tenant_id: tenant.id,
        family_id: family.id,
        parent_id: null,
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        icon: definition.icon,
        sort_order: definition.sort_order,
        is_active: true,
        allows_always_open: definition.allows_always_open ?? false,
      }
    )
    categories.set(definition.slug, category)
  }

  return { regions, cities, families, categories }
}

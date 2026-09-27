import factory from '@adonisjs/lucid/factories'

import { asciiSlug, realCity } from '#database/factories/support/pt_br'
import { DEMO_CITIES } from '#database/support/demo/catalog/geography'
import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'

const REGION_NAMES = ['Norte do Paraná', 'Norte Pioneiro', 'Vale do Ivaí', 'Região de Maringá']

export const RegionFactory = factory
  .define(Region, ({ faker }) => {
    const name = faker.helpers.arrayElement(REGION_NAMES)
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      name,
      slug: `${asciiSlug(name)}-${unique}`,
      description: `Praça demonstrativa de ${name}, com negócios locais e experiências regionais.`,
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (region) => {
    region.is_active = false
  })
  .build()

/**
 * A real city of the north of Paraná with the coordinates of its centre. The
 * default keeps a unique slug and no IBGE code, so several cities fit in one
 * operation; the named states give the exact city (slug, IBGE code, centre).
 */
export const CityFactory = factory
  .define(City, ({ faker }) => {
    const city = faker.helpers.arrayElement(DEMO_CITIES)
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      region_id: 1,
      name: city.name,
      slug: `${city.slug}-${unique}`,
      state_code: 'PR',
      country_code: 'BR',
      ibge_code: null,
      timezone: 'America/Sao_Paulo',
      latitude: city.latitude,
      longitude: city.longitude,
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (city) => {
    city.is_active = false
  })
  .state('londrina', (city) => void city.merge(realCity('londrina')))
  .state('maringa', (city) => void city.merge(realCity('maringa')))
  .state('apucarana', (city) => void city.merge(realCity('apucarana')))
  .state('arapongas', (city) => void city.merge(realCity('arapongas')))
  .state('cambe', (city) => void city.merge(realCity('cambe')))
  .state('rolandia', (city) => void city.merge(realCity('rolandia')))
  .state('ibipora', (city) => void city.merge(realCity('ibipora')))
  .state('cornelioProcopio', (city) => void city.merge(realCity('cornelio-procopio')))
  .state('bandeirantes', (city) => void city.merge(realCity('bandeirantes')))
  .build()

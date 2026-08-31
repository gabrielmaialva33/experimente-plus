import factory from '@adonisjs/lucid/factories'

import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'

export const RegionFactory = factory
  .define(Region, ({ faker }) => {
    const name = `${faker.location.city()} e região`
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${unique}`,
      description: faker.lorem.sentence(),
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (region) => {
    region.is_active = false
  })
  .build()

export const CityFactory = factory
  .define(City, ({ faker }) => {
    const name = faker.location.city()
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      region_id: 1,
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${unique}`,
      state_code: 'PR',
      country_code: 'BR',
      ibge_code: null,
      timezone: 'America/Sao_Paulo',
      latitude: Number(faker.location.latitude({ min: -26.5, max: -22.5 })),
      longitude: Number(faker.location.longitude({ min: -54.5, max: -48.5 })),
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (city) => {
    city.is_active = false
  })
  .build()

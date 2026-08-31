import factory from '@adonisjs/lucid/factories'

import Category from '#modules/taxonomy/models/category'
import CategoryFamily from '#modules/taxonomy/models/category_family'

export const CategoryFamilyFactory = factory
  .define(CategoryFamily, ({ faker }) => {
    const name = faker.commerce.department()
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${unique}`,
      description: faker.lorem.sentence(),
      icon: 'shapes',
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (family) => {
    family.is_active = false
  })
  .build()

export const CategoryFactory = factory
  .define(Category, ({ faker }) => {
    const name = faker.commerce.productAdjective()
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      family_id: 1,
      parent_id: null,
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${unique}`,
      description: faker.lorem.sentence(),
      icon: 'tag',
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
      allows_always_open: false,
    }
  })
  .state('alwaysOpen', (category) => {
    category.allows_always_open = true
  })
  .state('inactive', (category) => {
    category.is_active = false
  })
  .build()

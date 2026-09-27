import factory from '@adonisjs/lucid/factories'

import { asciiSlug } from '#database/factories/support/pt_br'
import { DEMO_CATEGORIES, DEMO_FAMILIES } from '#database/support/demo/catalog/taxonomy'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryFamily from '#modules/taxonomy/models/category_family'

/** A family of the demo taxonomy (Comer & Beber, Cultura & Lazer, …) with a unique slug. */
export const CategoryFamilyFactory = factory
  .define(CategoryFamily, ({ faker }) => {
    const family = faker.helpers.arrayElement(DEMO_FAMILIES)
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      name: family.name,
      slug: `${family.slug}-${unique}`,
      description: family.description,
      icon: family.icon,
      sort_order: faker.number.int({ min: 0, max: 100 }),
      is_active: true,
    }
  })
  .state('inactive', (family) => {
    family.is_active = false
  })
  .build()

/** A category of the demo taxonomy (Restaurantes, Cafés, Parques & trilhas, …) with a unique slug. */
export const CategoryFactory = factory
  .define(Category, ({ faker }) => {
    const category = faker.helpers.arrayElement(DEMO_CATEGORIES)
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      family_id: 1,
      parent_id: null,
      name: category.name,
      slug: `${asciiSlug(category.slug)}-${unique}`,
      description: category.description,
      icon: category.icon,
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

/** An attribute of a category's form; boolean by default. */
export const CategoryAttributeDefinitionFactory = factory
  .define(CategoryAttributeDefinition, ({ faker }) => {
    const unique = faker.string.alphanumeric(6).toLowerCase()
    return {
      tenant_id: 1,
      category_id: 1,
      key: `accepts_reservations_${unique}`,
      name: 'Aceita reservas',
      description: 'Reservas de mesa ou horário.',
      data_type: 'boolean' as const,
      unit: null,
      is_required: false,
      is_filterable: true,
      is_public: true,
      applies_to_descendants: false,
      sort_order: 0,
      is_active: true,
      validation_rules: {},
    }
  })
  .state('required', (definition) => {
    definition.is_required = true
  })
  .state('singleSelect', (definition) => {
    definition.data_type = 'single_select'
    definition.name = 'Faixa de preço'
    definition.description = 'Gasto médio por pessoa.'
  })
  .build()

export const CategoryAttributeOptionFactory = factory
  .define(CategoryAttributeOption, ({ faker }) => {
    const option = faker.helpers.arrayElement([
      { value: 'economico', label: 'Econômico (até R$ 40)' },
      { value: 'moderado', label: 'Moderado (R$ 40 a R$ 90)' },
      { value: 'especial', label: 'Especial (acima de R$ 90)' },
    ])
    return {
      tenant_id: 1,
      attribute_definition_id: 1,
      label: option.label,
      value: `${option.value}-${faker.string.alphanumeric(4).toLowerCase()}`,
      sort_order: 0,
      is_active: true,
    }
  })
  .build()

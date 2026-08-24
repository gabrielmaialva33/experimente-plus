import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import type Organization from '#modules/organizations/models/organization'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import {
  createOperation,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

let sequence = 0

export interface EstablishmentScenario {
  tenant: Tenant
  owner: User
  organization: Organization
  region: Region
  city: City
  family: CategoryFamily
  parentCategory: Category
  primaryCategory: Category
  inheritedBoolean: CategoryAttributeDefinition
  selectDefinition: CategoryAttributeDefinition
  standardOption: CategoryAttributeOption
  premiumOption: CategoryAttributeOption
}

export async function createEstablishmentScenario(
  prefix = 'establishment'
): Promise<EstablishmentScenario> {
  sequence += 1
  const suffix = sequence
  const tenant = await createOperation(`${prefix}-${suffix}`)
  const owner = await createUser({
    prefix: `${prefix}-owner-${suffix}`,
    tenant,
    tenantRole: 'owner',
  })
  const organization = await createOrganization({
    tenant,
    owner,
    prefix: `${prefix}-organization-${suffix}`,
    status: 'active',
  })

  const region = await Region.create({
    tenant_id: tenant.id,
    name: `Norte ${suffix}`,
    slug: `norte-${prefix}-${suffix}`,
    description: null,
    sort_order: 0,
    is_active: true,
  })
  const city = await City.create({
    tenant_id: tenant.id,
    region_id: region.id,
    name: `Cidade ${suffix}`,
    slug: `cidade-${prefix}-${suffix}`,
    state_code: 'PR',
    country_code: 'BR',
    ibge_code: null,
    timezone: 'America/Sao_Paulo',
    latitude: -23.18,
    longitude: -50.65,
    sort_order: 0,
    is_active: true,
  })

  const family = await CategoryFamily.create({
    tenant_id: tenant.id,
    name: `Comer e beber ${suffix}`,
    slug: `comer-e-beber-${prefix}-${suffix}`,
    description: null,
    icon: null,
    sort_order: 0,
    is_active: true,
  })
  const parentCategory = await Category.create({
    tenant_id: tenant.id,
    family_id: family.id,
    parent_id: null,
    name: `Restaurantes ${suffix}`,
    slug: `restaurantes-${prefix}-${suffix}`,
    description: null,
    icon: null,
    sort_order: 0,
    is_active: true,
    allows_always_open: false,
  })
  const primaryCategory = await Category.create({
    tenant_id: tenant.id,
    family_id: family.id,
    parent_id: parentCategory.id,
    name: `Cafeterias ${suffix}`,
    slug: `cafeterias-${prefix}-${suffix}`,
    description: null,
    icon: null,
    sort_order: 0,
    is_active: true,
    allows_always_open: false,
  })

  const inheritedBoolean = await CategoryAttributeDefinition.create({
    tenant_id: tenant.id,
    category_id: parentCategory.id,
    key: `accepts_reservations_${suffix}`,
    name: 'Aceita reservas',
    description: null,
    data_type: 'boolean',
    unit: null,
    is_required: true,
    is_filterable: true,
    is_public: true,
    applies_to_descendants: true,
    sort_order: 0,
    is_active: true,
    validation_rules: {},
  })
  const selectDefinition = await CategoryAttributeDefinition.create({
    tenant_id: tenant.id,
    category_id: primaryCategory.id,
    key: `price_level_${suffix}`,
    name: 'Faixa de preço',
    description: null,
    data_type: 'single_select',
    unit: null,
    is_required: true,
    is_filterable: true,
    is_public: true,
    applies_to_descendants: false,
    sort_order: 1,
    is_active: true,
    validation_rules: {},
  })
  const standardOption = await CategoryAttributeOption.create({
    tenant_id: tenant.id,
    attribute_definition_id: selectDefinition.id,
    label: 'Padrão',
    value: 'standard',
    sort_order: 0,
    is_active: true,
  })
  const premiumOption = await CategoryAttributeOption.create({
    tenant_id: tenant.id,
    attribute_definition_id: selectDefinition.id,
    label: 'Premium',
    value: 'premium',
    sort_order: 1,
    is_active: true,
  })

  return {
    tenant,
    owner,
    organization,
    region,
    city,
    family,
    parentCategory,
    primaryCategory,
    inheritedBoolean,
    selectDefinition,
    standardOption,
    premiumOption,
  }
}

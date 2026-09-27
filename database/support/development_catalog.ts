import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import Category from '#modules/taxonomy/models/category'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import type Tenant from '#modules/tenants/models/tenant'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import { DEMO_CITIES, DEMO_REGIONS } from '#database/support/demo/catalog/geography'
import {
  DEMO_ATTRIBUTES,
  DEMO_CATEGORIES,
  DEMO_FAMILIES,
} from '#database/support/demo/catalog/taxonomy'

export const DEVELOPMENT_DATA_NOTICE =
  'Cidades e códigos geográficos usam referências públicas. Organizações, estabelecimentos, endereços, contatos, imagens, ofertas e resgates são inteiramente fictícios e existem apenas para desenvolvimento e demonstração.'

/**
 * The development catalogue is the shared demo catalogue: the same regions,
 * cities, families, categories and attribute forms the homologation demo
 * provisions, so the two environments never drift. Development upserts them
 * (the database is disposable); homologation only ever creates what is missing.
 */
export const DEVELOPMENT_REGIONS = DEMO_REGIONS
export const DEVELOPMENT_CITIES = DEMO_CITIES
export const DEVELOPMENT_FAMILIES = DEMO_FAMILIES
export const DEVELOPMENT_CATEGORIES = DEMO_CATEGORIES

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

    for (const [index, attribute] of (DEMO_ATTRIBUTES[definition.slug] ?? []).entries()) {
      const attributeDefinition = await CategoryAttributeDefinition.updateOrCreate(
        { tenant_id: tenant.id, category_id: category.id, key: attribute.key },
        {
          tenant_id: tenant.id,
          category_id: category.id,
          key: attribute.key,
          name: attribute.name,
          description: attribute.description,
          data_type: attribute.data_type,
          unit: attribute.data_type === 'decimal' ? 'BRL' : null,
          is_required: attribute.is_required ?? false,
          is_filterable: attribute.is_filterable ?? false,
          is_public: true,
          applies_to_descendants: false,
          sort_order: index,
          is_active: true,
          validation_rules: attribute.validation_rules ?? {},
        }
      )
      for (const [optionIndex, option] of (attribute.options ?? []).entries()) {
        await CategoryAttributeOption.updateOrCreate(
          {
            tenant_id: tenant.id,
            attribute_definition_id: attributeDefinition.id,
            value: option.value,
          },
          {
            tenant_id: tenant.id,
            attribute_definition_id: attributeDefinition.id,
            label: option.label,
            value: option.value,
            sort_order: optionIndex,
            is_active: true,
          }
        )
      }
    }
  }

  return { regions, cities, families, categories }
}

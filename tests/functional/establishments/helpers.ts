import { DateTime } from 'luxon'

import db from '@adonisjs/lucid/services/db'

import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import City from '#modules/geography/models/city'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import StoredFile from '#modules/files/models/file'
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

let publishedSequence = 0

/**
 * An establishment a visitor can actually reach.
 *
 * A bare `Establishment` row is invisible to every public read. ADR-0016 §3
 * requires those reads to revalidate the sources behind the projection, so an
 * establishment only becomes discoverable once it carries an approved revision
 * in an active city of an active operation — which is also what creates its
 * projection row through the catalogue triggers.
 *
 * It lives here rather than inside one spec because the rule now has more than
 * one consumer: reviews observe an establishment through the public catalogue,
 * and partner-owned content of ADR-0028 is published on the same condition. Two
 * private copies of this setup would drift exactly where the drift is hardest
 * to see — a suite passing because its fixture is more permissive than
 * production.
 */
export async function createPublishedEstablishment(
  scenario: EstablishmentScenario,
  publicName = 'Cafe Central'
): Promise<Establishment> {
  publishedSequence += 1
  const cleanSlug = publicName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const establishment = await Establishment.create({
    tenant_id: scenario.tenant.id,
    organization_id: scenario.organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
    created_by: scenario.owner.id,
  })

  const revision = await EstablishmentRevision.create({
    establishment_id: establishment.id,
    tenant_id: scenario.tenant.id,
    version: 1,
    status: 'approved',
    public_name: publicName,
    slug: `${cleanSlug}-${publishedSequence}-${Date.now()}`,
    city_id: scenario.city.id,
    short_description: 'Cafes especiais e confeitaria artesanal.',
    created_by: scenario.owner.id,
    submitted_at: DateTime.utc(),
    reviewed_by: scenario.owner.id,
    reviewed_at: DateTime.utc(),
  })

  // Discoverability is not a flag anyone sets. The projection computes it, and
  // it requires an active category and exactly one approved cover: an
  // establishment without them is published but invisible, which is correct in
  // production and useless as a fixture. Building it here is what stops a suite
  // from asserting against a catalogue its own data can never enter.
  await EstablishmentRevisionCategory.create({
    tenant_id: scenario.tenant.id,
    revision_id: revision.id,
    category_id: scenario.primaryCategory.id,
    is_primary: true,
    sort_order: 0,
  })

  const file = await StoredFile.create({
    owner_id: scenario.owner.id,
    tenant_id: scenario.tenant.id,
    client_name: 'fachada.png',
    file_name: `fixture-${scenario.tenant.id}-${establishment.id}.png`,
    file_size: 128,
    file_type: 'image/png',
    file_category: 'image',
    url: `/storage/fixture-${establishment.id}.png`,
  })
  const asset = await MediaAsset.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    file_id: file.id,
    media_type: 'image',
    file_extension: 'png',
    mime_type: 'image/png',
    checksum_sha256: 'a'.repeat(64),
    width: 1200,
    height: 675,
    created_by: scenario.owner.id,
  })
  await EstablishmentRevisionMedia.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    revision_id: revision.id,
    media_asset_id: asset.id,
    purpose: 'gallery',
    is_cover: true,
    sort_order: 0,
    alt_text: `Fachada de ${publicName}`,
    moderation_status: 'approved',
    // The table refuses an approved image with no reviewer: approval is an act
    // someone performed, not a column value.
    reviewed_by: scenario.owner.id,
    reviewed_at: DateTime.utc(),
    created_by: scenario.owner.id,
  })

  establishment.published_revision_id = revision.id
  await establishment.save()

  // The categories and the cover were written after the row that triggers the
  // projection, so the projection is rebuilt once the revision is complete.
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
    scenario.tenant.id,
    establishment.id,
  ])

  return establishment
}

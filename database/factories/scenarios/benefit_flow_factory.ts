import { createHash, randomUUID } from 'node:crypto'

import { DateTime } from 'luxon'

import {
  BenefitAccessFactory,
  BenefitEditionFactory,
  BenefitOfferFactory,
  BenefitRedemptionFactory,
  CategoryFactory,
  CategoryFamilyFactory,
  CityFactory,
  EstablishmentFactory,
  EstablishmentRevisionAddressFactory,
  EstablishmentRevisionCategoryFactory,
  EstablishmentRevisionFactory,
  EstablishmentRevisionHourFactory,
  OrganizationFactory,
  OrganizationMemberFactory,
  RegionFactory,
  TenantFactory,
  UserFactory,
} from '#database/factories/index'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'

export interface BenefitFlowScenarioOptions {
  maxRedemptionsPerAccess?: number
  password?: string
  suffix?: string
  withRedemption?: boolean
}

export async function createBenefitFlowScenario(options: BenefitFlowScenarioOptions = {}) {
  const password = options.password ?? 'password123'
  const suffix = options.suffix ?? randomUUID().slice(0, 8)
  const tenant = await TenantFactory.merge({
    name: `Experimente Teste ${suffix}`,
    slug: `experimente-teste-${suffix}`,
  }).create()

  const admin = await UserFactory.merge({
    full_name: 'Administrador da operação',
    username: `admin_${suffix}`,
    email: `admin.${suffix}@example.test`,
    password,
  }).create()
  const partner = await UserFactory.merge({
    full_name: 'Parceiro demonstrativo',
    username: `partner_${suffix}`,
    email: `partner.${suffix}@example.test`,
    password,
  }).create()
  const holder = await UserFactory.merge({
    full_name: 'Consumidor demonstrativo',
    username: `holder_${suffix}`,
    email: `holder.${suffix}@example.test`,
    password,
  }).create()
  const outsider = await UserFactory.merge({
    full_name: 'Membro sem organização',
    username: `outsider_${suffix}`,
    email: `outsider.${suffix}@example.test`,
    password,
  }).create()

  const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
  await admin.related('roles').attach([adminRole.id])
  await admin.related('tenants').attach({ [tenant.id]: { role: 'owner' } })
  await partner.related('tenants').attach({ [tenant.id]: { role: 'member' } })
  await holder.related('tenants').attach({ [tenant.id]: { role: 'member' } })
  await outsider.related('tenants').attach({ [tenant.id]: { role: 'member' } })

  const region = await RegionFactory.merge({
    tenant_id: tenant.id,
    name: 'Norte do Paraná',
    slug: `norte-do-parana-${suffix}`,
    sort_order: 0,
  }).create()
  const city = await CityFactory.merge({
    tenant_id: tenant.id,
    region_id: region.id,
    name: 'Londrina',
    slug: `londrina-${suffix}`,
    ibge_code: '4113700',
    latitude: -23.3045,
    longitude: -51.1696,
    sort_order: 0,
  }).create()
  const family = await CategoryFamilyFactory.merge({
    tenant_id: tenant.id,
    name: 'Comer & Beber',
    slug: `comer-e-beber-${suffix}`,
    sort_order: 0,
  }).create()
  const category = await CategoryFactory.merge({
    tenant_id: tenant.id,
    family_id: family.id,
    name: 'Restaurantes',
    slug: `restaurantes-${suffix}`,
    sort_order: 0,
  }).create()

  const organization = await OrganizationFactory.apply('active')
    .merge({
      tenant_id: tenant.id,
      legal_name: 'Mesa Norte Gastronomia Ltda.',
      trade_name: 'Mesa Norte',
      slug: `mesa-norte-${suffix}`,
      tax_id: `10${suffix.replace(/\D/g, '').padEnd(12, '0').slice(0, 12)}`,
      email: `mesa.norte.${suffix}@example.test`,
      created_by: partner.id,
      reviewed_by: admin.id,
    })
    .create()
  const membership = await OrganizationMemberFactory.apply('owner')
    .merge({
      tenant_id: tenant.id,
      organization_id: organization.id,
      user_id: partner.id,
      invited_by: admin.id,
    })
    .create()

  const establishment = await EstablishmentFactory.merge({
    tenant_id: tenant.id,
    organization_id: organization.id,
    created_by: partner.id,
  }).create()
  const revision = await EstablishmentRevisionFactory.apply('approved')
    .merge({
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      city_id: city.id,
      public_name: 'Mesa Norte — Londrina',
      slug: `mesa-norte-londrina-${suffix}`,
      public_email: `londrina.${suffix}@example.test`,
      created_by: partner.id,
      reviewed_by: admin.id,
    })
    .create()
  const address = await EstablishmentRevisionAddressFactory.merge({
    tenant_id: tenant.id,
    revision_id: revision.id,
    postal_code: '86010000',
    street: 'Rua de Demonstração',
    number: '120',
    district: 'Centro',
    latitude: -23.3045,
    longitude: -51.1696,
  }).create()
  const revisionCategory = await EstablishmentRevisionCategoryFactory.merge({
    tenant_id: tenant.id,
    revision_id: revision.id,
    category_id: category.id,
  }).create()
  const hours = []
  for (const weekday of [1, 2, 3, 4, 5, 6]) {
    hours.push(
      await EstablishmentRevisionHourFactory.merge({
        tenant_id: tenant.id,
        revision_id: revision.id,
        weekday,
        opens_at: weekday === 6 ? '11:30' : '11:00',
        closes_at: weekday === 6 ? '23:00' : '22:30',
      }).create()
    )
  }

  establishment.published_revision_id = revision.id
  await establishment.save()

  const now = DateTime.utc()
  const edition = await BenefitEditionFactory.apply('published')
    .merge({
      tenant_id: tenant.id,
      city_id: city.id,
      name: 'Experimente Londrina — Teste',
      slug: `experimente-londrina-${suffix}`,
      sales_starts_at: now.minus({ days: 30 }),
      sales_ends_at: now.plus({ months: 3 }),
      usage_starts_at: now.minus({ days: 1 }),
      usage_ends_at: now.plus({ months: 8 }),
      created_by: admin.id,
    })
    .create()
  const offer = await BenefitOfferFactory.apply('buyOneGetOne')
    .apply('active')
    .merge({
      tenant_id: tenant.id,
      edition_id: edition.id,
      establishment_id: establishment.id,
      title: 'Peça um prato e receba outro',
      description: 'O segundo prato deve ter valor igual ou menor ao primeiro.',
      terms: 'Consumo no local. Não cumulativo com outras promoções.',
      max_redemptions_per_access: options.maxRedemptionsPerAccess ?? 1,
      created_by: partner.id,
    })
    .create()
  const access = await BenefitAccessFactory.merge({
    tenant_id: tenant.id,
    edition_id: edition.id,
    user_id: holder.id,
    granted_by: admin.id,
  }).create()

  const redemption = options.withRedemption
    ? await BenefitRedemptionFactory.merge({
        tenant_id: tenant.id,
        access_id: access.id,
        edition_id: edition.id,
        offer_id: offer.id,
        establishment_id: establishment.id,
        organization_id: organization.id,
        user_id: holder.id,
        redeemed_by: partner.id,
        presentation_nonce_hash: createHash('sha256')
          .update(`factory-redemption-${tenant.id}-${suffix}`)
          .digest('hex'),
        edition_name_snapshot: edition.name,
        offer_title_snapshot: offer.title,
        benefit_type_snapshot: offer.benefit_type,
        offer_terms_snapshot: offer.terms,
        establishment_name_snapshot: revision.public_name ?? 'Mesa Norte — Londrina',
        holder_name_snapshot: holder.full_name,
        holder_email_snapshot: holder.email,
      }).create()
    : null

  return {
    tenant,
    credentials: { password },
    users: { admin, partner, holder, outsider },
    geography: { region, city },
    taxonomy: { family, category },
    organization,
    membership,
    establishment,
    revision,
    address,
    revisionCategory,
    hours,
    edition,
    offer,
    access,
    redemption,
  }
}

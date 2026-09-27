import { randomUUID } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import {
  BenefitEditionFactory,
  BenefitOfferFactory,
  CategoryFactory,
  CategoryFamilyFactory,
  CityFactory,
  EstablishmentFactory,
  EstablishmentRevisionAddressFactory,
  EstablishmentRevisionCategoryFactory,
  EstablishmentRevisionFactory,
  EstablishmentRevisionHourFactory,
  EstablishmentRevisionMediaFactory,
  MediaAssetFactory,
  OrganizationFactory,
  OrganizationMemberFactory,
  RegionFactory,
  StoredFileFactory,
  TenantFactory,
  UserFactory,
} from '#database/factories/index'
import { asciiSlug } from '#database/factories/support/pt_br'
import { demoCity } from '#database/support/demo/catalog/geography'
import { DEMO_CATEGORIES, DEMO_FAMILIES } from '#database/support/demo/catalog/taxonomy'
import type EstablishmentReview from '#modules/reviews/models/establishment_review'
import type EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import EstablishmentReviewReplyService from '#modules/reviews/services/establishment_review_reply_service'
import EstablishmentReviewService from '#modules/reviews/services/establishment_review_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import type User from '#modules/users/models/user'

export interface PublishedPlaceScenarioOptions {
  suffix?: string
  password?: string
  /** A city of the demo geography; its real slug, IBGE code and centre are used. */
  city?: string
  /** A category of the demo taxonomy, by slug. */
  category?: string
  name?: string
  availability?: 'regular_hours' | 'appointment_only'
  businessStatus?: 'open' | 'temporarily_closed'
  /** Publishes an experience, an event tomorrow night and a showcase item through the service. */
  withContent?: boolean
  /** Adds a published city edition with an active offer at the place. */
  withOffer?: boolean
  /** Number of reviews, one per consumer, through the review service. The first gets a reply. */
  reviews?: number
}

const RATINGS = [5, 4, 5, 3, 4, 2] as const

/**
 * A place a visitor can find: an active organization with its partner, an
 * approved revision in a real city with address, category, weekly hours and
 * an approved cover, published and projected into the public catalogue. On
 * top, optionally, partner content, an offer and reviews — the same pieces the
 * demo catalogue publishes, at test speed.
 *
 * The aggregate is written with factories, as the other scenarios do, and the
 * projection is rebuilt at the end, because categories and the cover are
 * written after the row that triggers it. Content and reviews go through
 * their services so snapshots, policies and aggregates are real.
 */
export async function createPublishedPlaceScenario(options: PublishedPlaceScenarioOptions = {}) {
  const suffix = options.suffix ?? randomUUID().slice(0, 8)
  const password = options.password ?? 'password123'
  const cityDefinition = demoCity(options.city ?? 'londrina')
  const categoryDefinition =
    DEMO_CATEGORIES.find((category) => category.slug === (options.category ?? 'restaurantes')) ??
    DEMO_CATEGORIES[0]
  const familyDefinition = DEMO_FAMILIES.find(
    (family) => family.slug === categoryDefinition.family_slug
  )!

  const tenant = await TenantFactory.merge({
    name: `Experimente Cenário ${suffix}`,
    slug: `experimente-cenario-${asciiSlug(suffix)}`,
  }).create()

  const admin = await UserFactory.merge({ password }).create()
  const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
  await admin.related('roles').attach([adminRole.id])
  await admin.related('tenants').attach({ [tenant.id]: { role: 'owner' } })
  const partner = await UserFactory.merge({ password }).create()
  await partner.related('tenants').attach({ [tenant.id]: { role: 'member' } })
  const consumers: User[] = []
  for (let index = 0; index < (options.reviews ?? 0); index++) {
    const consumer = await UserFactory.merge({ password }).create()
    await consumer.related('tenants').attach({ [tenant.id]: { role: 'member' } })
    consumers.push(consumer)
  }

  const region = await RegionFactory.merge({
    tenant_id: tenant.id,
    name: 'Norte do Paraná',
    slug: 'norte-do-parana',
  }).create()
  const city = await CityFactory.merge({
    tenant_id: tenant.id,
    region_id: region.id,
    name: cityDefinition.name,
    slug: cityDefinition.slug,
    ibge_code: cityDefinition.ibge_code,
    latitude: cityDefinition.latitude,
    longitude: cityDefinition.longitude,
  }).create()
  const family = await CategoryFamilyFactory.merge({
    tenant_id: tenant.id,
    name: familyDefinition.name,
    slug: familyDefinition.slug,
    icon: familyDefinition.icon,
  }).create()
  const category = await CategoryFactory.merge({
    tenant_id: tenant.id,
    family_id: family.id,
    name: categoryDefinition.name,
    slug: categoryDefinition.slug,
    icon: categoryDefinition.icon,
  }).create()

  const organization = await OrganizationFactory.apply('active')
    .merge({ tenant_id: tenant.id, created_by: partner.id })
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
  const name = options.name ?? `Cantina Vale Verde ${suffix}`
  const revisionBuilder = EstablishmentRevisionFactory.apply('approved').merge({
    tenant_id: tenant.id,
    establishment_id: establishment.id,
    city_id: city.id,
    public_name: name,
    slug: asciiSlug(name),
    created_by: partner.id,
  })
  const revision = await (
    options.availability === 'appointment_only'
      ? revisionBuilder.apply('appointmentOnly')
      : revisionBuilder
  ).create()

  const address = await EstablishmentRevisionAddressFactory.merge({
    tenant_id: tenant.id,
    revision_id: revision.id,
    street: 'Endereço demonstrativo',
    district: 'Centro',
    // A few hundred metres from the centre: inside the city, off its exact point.
    latitude: Number((cityDefinition.latitude + 0.0021).toFixed(7)),
    longitude: Number((cityDefinition.longitude - 0.0034).toFixed(7)),
  }).create()
  await EstablishmentRevisionCategoryFactory.merge({
    tenant_id: tenant.id,
    revision_id: revision.id,
    category_id: category.id,
  }).create()
  const hours =
    options.availability === 'appointment_only'
      ? []
      : [
          ...(await EstablishmentRevisionHourFactory.apply('lunch')
            .merge(
              [2, 3, 4, 5, 6, 0].map((weekday) => ({
                tenant_id: tenant.id,
                revision_id: revision.id,
                weekday,
                sort_order: 0,
              }))
            )
            .createMany(6)),
          ...(await EstablishmentRevisionHourFactory.apply('evening')
            .merge(
              [2, 3, 4, 5, 6].map((weekday) => ({
                tenant_id: tenant.id,
                revision_id: revision.id,
                weekday,
                sort_order: 1,
              }))
            )
            .createMany(5)),
        ]

  const file = await StoredFileFactory.merge({
    tenant_id: tenant.id,
    owner_id: partner.id,
  }).create()
  const asset = await MediaAssetFactory.merge({
    tenant_id: tenant.id,
    establishment_id: establishment.id,
    file_id: file.id,
    created_by: partner.id,
  }).create()
  const cover = await EstablishmentRevisionMediaFactory.apply('cover')
    .apply('approved')
    .merge({
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      revision_id: revision.id,
      media_asset_id: asset.id,
      alt_text: `Ilustração original da capa de ${name}`,
      created_by: partner.id,
      reviewed_by: admin.id,
    })
    .create()

  establishment.published_revision_id = revision.id
  if (options.businessStatus === 'temporarily_closed')
    establishment.business_status = 'temporarily_closed'
  await establishment.save()
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [tenant.id, establishment.id])

  const content: Partial<Record<IPartnerContent.ContentKind, IPartnerContent.ContentRow>> = {}
  if (options.withContent) {
    const service = await app.container.make(PartnerContentService)
    const policies = new PartnerContentPolicyRepository()
    const policy = await policies.getForTenant(tenant.id)
    const tomorrow = DateTime.now()
      .setZone('America/Sao_Paulo')
      .plus({ days: 1 })
      .set({ hour: 19, minute: 0, second: 0, millisecond: 0 })
    const payloads: Array<[IPartnerContent.ContentKind, IPartnerContent.CreatePayload]> = [
      [
        'experience',
        {
          establishment_id: establishment.id,
          title: 'Aula de massa fresca em família',
          description: 'Experiência fictícia para cenários de teste.',
        },
      ],
      [
        'event',
        {
          establishment_id: establishment.id,
          title: 'Noite da massa fresca',
          description: 'Evento fictício para cenários de teste.',
          starts_at: tomorrow.toUTC().toISO()!,
          ends_at: tomorrow.plus({ hours: 3 }).toUTC().toISO()!,
        },
      ],
      [
        'showcase_item',
        {
          establishment_id: establishment.id,
          title: 'Talharim ao molho de tomate assado',
          description: 'Item fictício; preço apenas informativo.',
          informational_price_cents: 4890,
        },
      ],
    ]
    for (const [kind, payload] of payloads) {
      const created = await service.create(kind, tenant.id, partner, payload)
      const submitted = await service.submit(kind, tenant.id, created.id, partner)
      content[kind] =
        submitted.status === 'pending_review' && policies.requiresApproval(policy, kind)
          ? await service.approve(kind, tenant.id, created.id, admin)
          : submitted
    }
  }

  let edition = null
  let offer = null
  if (options.withOffer) {
    edition = await BenefitEditionFactory.apply('published')
      .merge({
        tenant_id: tenant.id,
        city_id: city.id,
        name: `Passaporte Experimente ${cityDefinition.name}`,
        slug: `passaporte-${cityDefinition.slug}-${asciiSlug(suffix)}`,
        created_by: admin.id,
      })
      .create()
    offer = await BenefitOfferFactory.apply('buyOneGetOne')
      .apply('active')
      .merge({
        tenant_id: tenant.id,
        edition_id: edition.id,
        establishment_id: establishment.id,
        title: 'Segundo prato por conta da casa',
        created_by: partner.id,
      })
      .create()
  }

  const reviews: EstablishmentReview[] = []
  const replies: EstablishmentReviewReply[] = []
  if (consumers.length > 0) {
    const reviewService = await app.container.make(EstablishmentReviewService)
    const replyService = await app.container.make(EstablishmentReviewReplyService)
    for (const [index, consumer] of consumers.entries()) {
      const rating = RATINGS[index % RATINGS.length]
      reviews.push(
        await reviewService.create(tenant.id, consumer, {
          establishment_id: establishment.id,
          rating,
          comment:
            rating >= 4
              ? 'Comida bem feita e atendimento atencioso. Volto com certeza.'
              : 'Bom lugar, mas a espera foi longa no horário de pico.',
        })
      )
    }
    replies.push(
      await replyService.reply(tenant.id, reviews[0].id, partner, {
        comment: 'Obrigado pela visita! Esperamos você de novo.',
      })
    )
  }

  return {
    tenant,
    credentials: { password },
    users: { admin, partner, consumers },
    geography: { region, city },
    taxonomy: { family, category },
    organization,
    membership,
    establishment,
    revision,
    address,
    hours,
    media: { file, asset, cover },
    content,
    edition,
    offer,
    reviews,
    replies,
  }
}

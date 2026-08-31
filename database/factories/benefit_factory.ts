import { createHash, randomUUID } from 'node:crypto'

import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitRedemption from '#modules/benefits/models/benefit_redemption'

export const BenefitEditionFactory = factory
  .define(BenefitEdition, ({ faker }) => {
    const now = DateTime.utc()
    const cityLabel = faker.location.city()
    const unique = faker.string.alphanumeric(6).toLowerCase()

    return {
      tenant_id: 1,
      city_id: 1,
      name: `Experimente ${cityLabel}`,
      slug: `experimente-${faker.helpers.slugify(cityLabel).toLowerCase()}-${unique}`,
      description: faker.lorem.sentences(2),
      price_cents: faker.number.int({ min: 7990, max: 19990 }),
      currency: 'BRL',
      sales_starts_at: now.minus({ days: 15 }),
      sales_ends_at: now.plus({ days: 60 }),
      usage_starts_at: now.minus({ days: 1 }),
      usage_ends_at: now.plus({ months: 8 }),
      status: 'draft' as const,
      created_by: null,
      published_at: null,
      archived_at: null,
    }
  })
  .state('published', (edition) => {
    edition.status = 'published'
    edition.published_at = DateTime.utc()
    edition.archived_at = null
  })
  .state('paused', (edition) => {
    edition.status = 'paused'
    edition.published_at ??= DateTime.utc()
    edition.archived_at = null
  })
  .state('archived', (edition) => {
    edition.status = 'archived'
    edition.archived_at = DateTime.utc()
  })
  .state('upcoming', (edition) => {
    const now = DateTime.utc()
    edition.usage_starts_at = now.plus({ months: 1 })
    edition.usage_ends_at = now.plus({ months: 9 })
  })
  .build()

export const BenefitOfferFactory = factory
  .define(BenefitOffer, ({ faker }) => ({
    tenant_id: 1,
    edition_id: 1,
    establishment_id: 1,
    title: faker.commerce.productAdjective() + ' benefício',
    description: faker.lorem.sentence(),
    benefit_type: 'custom' as const,
    discount_percentage: null,
    discount_amount_cents: null,
    terms: 'Benefício individual, não cumulativo e sujeito à disponibilidade.',
    available_weekdays_mask: 127,
    daily_start_time: null,
    daily_end_time: null,
    starts_at: null,
    ends_at: null,
    reservation_required: false,
    on_premise_only: true,
    minimum_party_size: 1,
    max_redemptions_per_access: 1,
    status: 'draft' as const,
    created_by: null,
    activated_at: null,
    archived_at: null,
  }))
  .state('active', (offer) => {
    offer.status = 'active'
    offer.activated_at = DateTime.utc()
    offer.archived_at = null
  })
  .state('paused', (offer) => {
    offer.status = 'paused'
    offer.activated_at ??= DateTime.utc()
    offer.archived_at = null
  })
  .state('archived', (offer) => {
    offer.status = 'archived'
    offer.archived_at = DateTime.utc()
  })
  .state('percentage', (offer, { faker }) => {
    offer.benefit_type = 'percentage'
    offer.discount_percentage = faker.number.int({ min: 10, max: 50 })
    offer.discount_amount_cents = null
  })
  .state('fixedAmount', (offer, { faker }) => {
    offer.benefit_type = 'fixed_amount'
    offer.discount_percentage = null
    offer.discount_amount_cents = faker.number.int({ min: 1000, max: 5000 })
  })
  .state('buyOneGetOne', (offer) => {
    offer.benefit_type = 'buy_one_get_one'
    offer.discount_percentage = null
    offer.discount_amount_cents = null
  })
  .build()

export const BenefitAccessFactory = factory
  .define(BenefitAccess, () => ({
    tenant_id: 1,
    edition_id: 1,
    user_id: 1,
    source: 'courtesy' as const,
    status: 'active' as const,
    external_reference: null,
    notes: 'Acesso gerado por factory para cenário automatizado.',
    granted_by: null,
    granted_at: DateTime.utc(),
    revoked_by: null,
    revoked_at: null,
    revocation_reason: null,
  }))
  .state('manual', (access) => {
    access.source = 'manual'
  })
  .state('payment', (access) => {
    access.source = 'payment'
    access.external_reference = `factory-payment-${randomUUID()}`
  })
  .state('revoked', (access) => {
    access.status = 'revoked'
    access.revoked_by = access.granted_by
    access.revoked_at = DateTime.utc()
    access.revocation_reason = 'Acesso revogado pelo cenário de teste.'
  })
  .build()

export const BenefitRedemptionFactory = factory
  .define(BenefitRedemption, ({ faker }) => {
    const nonce = randomUUID()
    const receipt = `EXP-${faker.string.alphanumeric(16).toUpperCase()}`

    return {
      tenant_id: 1,
      access_id: 1,
      edition_id: 1,
      offer_id: 1,
      establishment_id: 1,
      organization_id: 1,
      user_id: 1,
      redeemed_by: 1,
      redemption_number: 1,
      presentation_nonce_hash: createHash('sha256').update(nonce).digest('hex'),
      receipt_code: receipt,
      edition_name_snapshot: 'Edição demonstrativa',
      offer_title_snapshot: 'Benefício demonstrativo',
      benefit_type_snapshot: 'custom',
      offer_terms_snapshot: 'Benefício individual, não cumulativo.',
      establishment_name_snapshot: faker.company.name(),
      holder_name_snapshot: faker.person.fullName(),
      holder_email_snapshot: faker.internet.email({ provider: 'example.test' }).toLowerCase(),
      redeemed_at: DateTime.utc(),
    }
  })
  .build()

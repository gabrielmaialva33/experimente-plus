import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import IRole from '#modules/roles/interfaces/role_interface'
import User from '#modules/users/models/user'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

let sequence = 0

async function createPublishedEstablishment(options: {
  tenantId: number
  organizationId: number
  cityId: number
  ownerId: number
  reviewerId: number
  suffix: string
}): Promise<Establishment> {
  const establishment = await Establishment.create({
    tenant_id: options.tenantId,
    organization_id: options.organizationId,
    lifecycle_status: 'active',
    business_status: 'open',
    published_revision_id: null,
    created_by: options.ownerId,
  })
  const reviewedAt = DateTime.utc()
  const revision = await EstablishmentRevision.create({
    tenant_id: options.tenantId,
    establishment_id: establishment.id,
    version: 1,
    status: 'approved',
    city_id: options.cityId,
    public_name: `Lugar da carteira ${options.suffix}`,
    slug: `lugar-carteira-${options.suffix}`,
    short_description: 'Uma unidade publicada para validar a carteira de benefícios.',
    description: null,
    public_phone: null,
    whatsapp: null,
    public_email: null,
    website: null,
    instagram: null,
    booking_url: null,
    availability_type: 'regular_hours',
    based_on_revision_id: null,
    created_by: options.ownerId,
    submitted_at: reviewedAt,
    reviewed_by: options.reviewerId,
    reviewed_at: reviewedAt,
    review_notes: 'Publicação preparada para o cenário de carteira.',
    rules_version: 2,
  })

  establishment.published_revision_id = revision.id
  await establishment.save()
  return establishment
}

async function createEdition(options: {
  tenantId: number
  cityId: number
  adminId: number
  suffix: string
  status?: 'draft' | 'published' | 'paused' | 'archived'
  usageStartsAt?: DateTime
  usageEndsAt?: DateTime
}): Promise<BenefitEdition> {
  sequence += 1
  const status = options.status ?? 'published'
  const now = DateTime.utc()

  return BenefitEdition.create({
    tenant_id: options.tenantId,
    city_id: options.cityId,
    name: `Edição ${options.suffix} ${sequence}`,
    slug: `edicao-${options.suffix}-${sequence}`,
    description: `Carteira funcional da edição ${options.suffix}.`,
    price_cents: 14990,
    currency: 'BRL',
    sales_starts_at: null,
    sales_ends_at: null,
    usage_starts_at: options.usageStartsAt ?? now.minus({ days: 1 }),
    usage_ends_at: options.usageEndsAt ?? now.plus({ days: 30 }),
    status,
    created_by: options.adminId,
    published_at: status === 'draft' ? null : now,
    archived_at: status === 'archived' ? now : null,
  })
}

async function createOffer(options: {
  tenantId: number
  editionId: number
  establishmentId: number
  actorId: number
  suffix: string
  status?: 'active' | 'paused'
  availableWeekdaysMask?: number
}): Promise<BenefitOffer> {
  const now = DateTime.utc()
  const status = options.status ?? 'active'

  return BenefitOffer.create({
    tenant_id: options.tenantId,
    edition_id: options.editionId,
    establishment_id: options.establishmentId,
    title: `20% no menu ${options.suffix}`,
    description: 'Desconto válido para itens participantes durante a edição.',
    benefit_type: 'percentage',
    discount_percentage: 20,
    discount_amount_cents: null,
    terms: 'Não cumulativo com outras promoções.',
    available_weekdays_mask: options.availableWeekdaysMask ?? 127,
    daily_start_time: null,
    daily_end_time: null,
    starts_at: null,
    ends_at: null,
    reservation_required: false,
    on_premise_only: true,
    minimum_party_size: 1,
    max_redemptions_per_access: 1,
    status,
    created_by: options.actorId,
    activated_at: now,
    archived_at: null,
  })
}

async function createDirectAccess(options: {
  tenantId: number
  editionId: number
  userId: number
  adminId: number
  source?: 'manual' | 'courtesy' | 'payment' | 'promo_code' | 'migration'
  externalReference?: string | null
}): Promise<BenefitAccess> {
  return BenefitAccess.create({
    tenant_id: options.tenantId,
    edition_id: options.editionId,
    user_id: options.userId,
    source: options.source ?? 'manual',
    status: 'active',
    external_reference: options.externalReference ?? null,
    notes: null,
    granted_by: options.adminId,
    granted_at: DateTime.utc(),
    revoked_by: null,
    revoked_at: null,
    revocation_reason: null,
  })
}

async function createBaseFixture(suffix: string) {
  const scenario = await createEstablishmentScenario(`access-${suffix}`)
  const admin = await createUser({
    prefix: `access-admin-${suffix}`,
    tenant: scenario.tenant,
    globalRole: IRole.Slugs.ADMIN,
    tenantRole: 'admin',
  })
  const consumer = await createUser({
    prefix: `access-consumer-${suffix}`,
    tenant: scenario.tenant,
    tenantRole: 'member',
  })
  const establishment = await createPublishedEstablishment({
    tenantId: scenario.tenant.id,
    organizationId: scenario.organization.id,
    cityId: scenario.city.id,
    ownerId: scenario.owner.id,
    reviewerId: admin.id,
    suffix,
  })

  return { scenario, admin, consumer, establishment }
}

function grantPayload(editionId: number, email: string) {
  return {
    edition_id: editionId,
    email,
    source: 'courtesy',
    external_reference: null,
    notes: 'Cortesia para validar o fluxo comercial.',
  }
}

test.group('Benefit access and wallet', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('allows only operation administrators to grant access and rejects an active duplicate', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, consumer, establishment } = await createBaseFixture('grant')
    const edition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'grant',
    })
    await createOffer({
      tenantId: scenario.tenant.id,
      editionId: edition.id,
      establishmentId: establishment.id,
      actorId: scenario.owner.id,
      suffix: 'grant',
    })

    const forbidden = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json(grantPayload(edition.id, consumer.email))
    forbidden.assertStatus(403)

    const granted = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(grantPayload(edition.id, consumer.email.toUpperCase()))
    granted.assertStatus(201)
    assert.equal(granted.body().status, 'active')
    assert.equal(granted.body().source, 'courtesy')
    assert.equal(granted.body().user_id, consumer.id)
    assert.equal(granted.body().edition_id, edition.id)

    const duplicate = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(grantPayload(edition.id, consumer.email))
    duplicate.assertStatus(400)
  })

  test('rejects unavailable editions, foreign holders and duplicate payment references', async ({
    client,
  }) => {
    const { scenario, admin, consumer } = await createBaseFixture('integrity')
    const secondConsumer = await createUser({
      prefix: 'access-integrity-second',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const outsider = await createUser({ prefix: 'access-integrity-outsider' })
    const now = DateTime.utc()
    const draftEdition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'draft',
      status: 'draft',
    })
    const archivedEdition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'archived',
      status: 'archived',
    })
    const expiredEdition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'expired',
      usageStartsAt: now.minus({ days: 30 }),
      usageEndsAt: now.minus({ days: 1 }),
    })
    const publishedEdition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'published',
    })

    for (const edition of [draftEdition, archivedEdition, expiredEdition]) {
      const response = await client
        .post('/api/v1/admin/benefit-accesses')
        .header('x-tenant-id', String(scenario.tenant.id))
        .loginAs(admin)
        .json(grantPayload(edition.id, consumer.email))
      response.assertStatus(400)
    }

    const foreignHolder = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(grantPayload(publishedEdition.id, outsider.email))
    foreignHolder.assertStatus(400)

    const missingPaymentReference = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json({
        edition_id: publishedEdition.id,
        email: consumer.email,
        source: 'payment',
      })
    missingPaymentReference.assertStatus(400)

    const paid = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json({
        edition_id: publishedEdition.id,
        email: consumer.email,
        source: 'payment',
        external_reference: 'PAYMENT-1001',
      })
    paid.assertStatus(201)

    const replayedPayment = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json({
        edition_id: publishedEdition.id,
        email: secondConsumer.email,
        source: 'payment',
        external_reference: 'PAYMENT-1001',
      })
    replayedPayment.assertStatus(400)
  })

  test('returns only the authenticated holder wallet and derives an available benefit', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, consumer, establishment } = await createBaseFixture('wallet')
    const secondConsumer = await createUser({
      prefix: 'access-wallet-second',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const edition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'wallet',
    })
    const offer = await createOffer({
      tenantId: scenario.tenant.id,
      editionId: edition.id,
      establishmentId: establishment.id,
      actorId: scenario.owner.id,
      suffix: 'wallet',
    })
    await createDirectAccess({
      tenantId: scenario.tenant.id,
      editionId: edition.id,
      userId: consumer.id,
      adminId: admin.id,
    })

    const foreignEdition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'foreign-wallet',
    })
    await createOffer({
      tenantId: scenario.tenant.id,
      editionId: foreignEdition.id,
      establishmentId: establishment.id,
      actorId: scenario.owner.id,
      suffix: 'foreign-wallet',
    })
    await createDirectAccess({
      tenantId: scenario.tenant.id,
      editionId: foreignEdition.id,
      userId: secondConsumer.id,
      adminId: admin.id,
    })

    const wallet = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(consumer)
    wallet.assertStatus(200)
    assert.equal(wallet.body().summary.passes, 1)
    assert.equal(wallet.body().summary.available, 1)
    assert.equal(wallet.body().passes[0].edition.id, edition.id)
    assert.equal(wallet.body().passes[0].benefits[0].offer_id, offer.id)
    assert.equal(wallet.body().passes[0].benefits[0].availability, 'available')
    assert.notInclude(
      wallet.body().passes.map((pass: { edition: { id: number } }) => pass.edition.id),
      foreignEdition.id
    )
  })

  test('revokes an access, preserves history and allows a new grant', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, consumer } = await createBaseFixture('lifecycle')
    const edition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'lifecycle',
    })

    const firstGrant = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(grantPayload(edition.id, consumer.email))
    firstGrant.assertStatus(201)
    const firstAccessId = Number(firstGrant.body().id)

    const revoked = await client
      .post(`/api/v1/admin/benefit-accesses/${firstAccessId}/revoke`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json({ reason: 'Solicitação registrada pela operação.' })
    revoked.assertStatus(200)
    assert.equal(revoked.body().status, 'revoked')
    assert.equal(revoked.body().revocation_reason, 'Solicitação registrada pela operação.')

    const secondGrant = await client
      .post('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json({
        edition_id: edition.id,
        email: consumer.email,
        source: 'promo_code',
        external_reference: 'PROMO-2026',
      })
    secondGrant.assertStatus(201)
    assert.notEqual(secondGrant.body().id, firstAccessId)

    const history = await BenefitAccess.query()
      .where('tenant_id', scenario.tenant.id)
      .where('edition_id', edition.id)
      .where('user_id', consumer.id)
      .orderBy('id', 'asc')
    assert.lengthOf(history, 2)
    assert.equal(history[0].status, 'revoked')
    assert.equal(history[1].status, 'active')
  })

  test('derives available, upcoming, paused, expired and outside-schedule states', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, consumer, establishment } = await createBaseFixture('states')
    const now = DateTime.utc()
    const localNow = now.setZone(scenario.city.timezone)
    const currentWeekdayBit = localNow.weekday === 7 ? 1 : 1 << localNow.weekday
    const unavailableTodayMask = 127 ^ currentWeekdayBit
    const configurations = [
      {
        suffix: 'available',
        editionStatus: 'published' as const,
        starts: now.minus({ days: 1 }),
        ends: now.plus({ days: 10 }),
        weekdaysMask: 127,
        expected: 'available',
      },
      {
        suffix: 'upcoming',
        editionStatus: 'published' as const,
        starts: now.plus({ days: 2 }),
        ends: now.plus({ days: 20 }),
        weekdaysMask: 127,
        expected: 'upcoming',
      },
      {
        suffix: 'paused',
        editionStatus: 'paused' as const,
        starts: now.minus({ days: 1 }),
        ends: now.plus({ days: 10 }),
        weekdaysMask: 127,
        expected: 'paused',
      },
      {
        suffix: 'expired',
        editionStatus: 'published' as const,
        starts: now.minus({ days: 20 }),
        ends: now.minus({ days: 1 }),
        weekdaysMask: 127,
        expected: 'expired',
      },
      {
        suffix: 'schedule',
        editionStatus: 'published' as const,
        starts: now.minus({ days: 1 }),
        ends: now.plus({ days: 10 }),
        weekdaysMask: unavailableTodayMask,
        expected: 'outside_schedule',
      },
    ]

    for (const configuration of configurations) {
      const edition = await createEdition({
        tenantId: scenario.tenant.id,
        cityId: scenario.city.id,
        adminId: admin.id,
        suffix: configuration.suffix,
        status: configuration.editionStatus,
        usageStartsAt: configuration.starts,
        usageEndsAt: configuration.ends,
      })
      await createOffer({
        tenantId: scenario.tenant.id,
        editionId: edition.id,
        establishmentId: establishment.id,
        actorId: scenario.owner.id,
        suffix: configuration.suffix,
        availableWeekdaysMask: configuration.weekdaysMask,
      })
      await createDirectAccess({
        tenantId: scenario.tenant.id,
        editionId: edition.id,
        userId: consumer.id,
        adminId: admin.id,
      })
    }

    const response = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(consumer)
    response.assertStatus(200)

    const states = new Map<string, string>()
    for (const pass of response.body().passes) {
      for (const configuration of configurations) {
        if (pass.edition.name.includes(configuration.suffix)) {
          states.set(configuration.suffix, pass.benefits[0].availability)
        }
      }
    }

    for (const configuration of configurations) {
      assert.equal(states.get(configuration.suffix), configuration.expected)
    }
  })

  test('renders the private access backoffice and consumer wallet pages', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, consumer } = await createBaseFixture('pages')

    const backoffice = await client
      .get('/backoffice/accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
    backoffice.assertStatus(200)
    backoffice.assertHeader('cache-control', 'private, no-store')
    backoffice.assertHeader('x-robots-tag', 'noindex, nofollow')
    assert.include(backoffice.text(), 'backoffice/benefits/accesses')

    const wallet = await client
      .get('/wallet')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(consumer)
    wallet.assertStatus(200)
    wallet.assertHeader('cache-control', 'private, no-store')
    wallet.assertHeader('x-robots-tag', 'noindex, nofollow')
    assert.include(wallet.text(), 'wallet/index')
  })

  test('lets moderators inspect access history while keeping grants admin-only', async ({
    client,
    assert,
  }) => {
    const { scenario } = await createBaseFixture('moderator-read')
    const moderator = await createUser({
      prefix: 'access-moderator-read',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
      tenantRole: 'member',
    })

    const backoffice = await client
      .get('/backoffice/accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(moderator)
    backoffice.assertStatus(200)
    assert.include(backoffice.text(), 'backoffice/benefits/accesses')

    const api = await client
      .get('/api/v1/admin/benefit-accesses')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(moderator)
    api.assertStatus(200)

    const grantAttempt = await client
      .post('/backoffice/accesses')
      .withCsrfToken()
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(moderator)
    grantAttempt.assertStatus(403)
  })

  test('enforces the user and tenant relationship at the database boundary', async ({ assert }) => {
    const { scenario, admin } = await createBaseFixture('database')
    const outsider = await User.create({
      full_name: 'Database outsider',
      email: 'database-outsider@example.com',
      username: 'database-outsider',
      password: 'password123',
    })
    const edition = await createEdition({
      tenantId: scenario.tenant.id,
      cityId: scenario.city.id,
      adminId: admin.id,
      suffix: 'database',
    })

    await assert.rejects(() =>
      BenefitAccess.create({
        tenant_id: scenario.tenant.id,
        edition_id: edition.id,
        user_id: outsider.id,
        source: 'manual',
        status: 'active',
        external_reference: null,
        notes: null,
        granted_by: admin.id,
        granted_at: DateTime.utc(),
        revoked_by: null,
        revoked_at: null,
        revocation_reason: null,
      })
    )
  })
})

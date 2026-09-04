import app from '@adonisjs/core/services/app'

import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'

import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitRedemption from '#modules/benefits/models/benefit_redemption'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import IRole from '#modules/roles/interfaces/role_interface'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'

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
    public_name: `Parceiro de resgate ${options.suffix}`,
    slug: `parceiro-resgate-${options.suffix}`,
    short_description: 'Unidade publicada para validar o fluxo de resgate.',
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
    review_notes: 'Publicação preparada para o cenário de resgate.',
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
}): Promise<BenefitEdition> {
  sequence += 1
  const now = DateTime.utc()
  return BenefitEdition.create({
    tenant_id: options.tenantId,
    city_id: options.cityId,
    name: `Edição resgate ${options.suffix} ${sequence}`,
    slug: `edicao-resgate-${options.suffix}-${sequence}`,
    description: 'Edição publicada para validar o fluxo presencial.',
    price_cents: 14990,
    currency: 'BRL',
    sales_starts_at: null,
    sales_ends_at: null,
    usage_starts_at: now.minus({ days: 1 }),
    usage_ends_at: now.plus({ days: 30 }),
    status: 'published',
    created_by: options.adminId,
    published_at: now,
    archived_at: null,
  })
}

async function createOffer(options: {
  tenantId: number
  editionId: number
  establishmentId: number
  actorId: number
  suffix: string
  maxRedemptions?: number
}): Promise<BenefitOffer> {
  const now = DateTime.utc()
  return BenefitOffer.create({
    tenant_id: options.tenantId,
    edition_id: options.editionId,
    establishment_id: options.establishmentId,
    title: `Benefício presencial ${options.suffix}`,
    description: 'Uma oferta ativa disponível para apresentação e confirmação presencial.',
    benefit_type: 'percentage',
    discount_percentage: 20,
    discount_amount_cents: null,
    terms: 'Apresente antes de pedir a conta. Não cumulativo.',
    available_weekdays_mask: 127,
    daily_start_time: null,
    daily_end_time: null,
    starts_at: null,
    ends_at: null,
    reservation_required: false,
    on_premise_only: true,
    minimum_party_size: 1,
    max_redemptions_per_access: options.maxRedemptions ?? 1,
    status: 'active',
    created_by: options.actorId,
    activated_at: now,
    archived_at: null,
  })
}

async function createAccess(options: {
  tenantId: number
  editionId: number
  userId: number
  adminId: number
}): Promise<BenefitAccess> {
  return BenefitAccess.create({
    tenant_id: options.tenantId,
    edition_id: options.editionId,
    user_id: options.userId,
    source: 'courtesy',
    status: 'active',
    external_reference: null,
    notes: null,
    granted_by: options.adminId,
    granted_at: DateTime.utc(),
    revoked_by: null,
    revoked_at: null,
    revocation_reason: null,
  })
}

async function createFixture(suffix: string, maxRedemptions = 1) {
  const scenario = await createEstablishmentScenario(`redemption-${suffix}`)
  const admin = await createUser({
    prefix: `redemption-admin-${suffix}`,
    tenant: scenario.tenant,
    globalRole: IRole.Slugs.ADMIN,
    tenantRole: 'admin',
  })
  const consumer = await createUser({
    prefix: `redemption-consumer-${suffix}`,
    tenant: scenario.tenant,
    tenantRole: 'member',
  })
  const outsider = await createUser({
    prefix: `redemption-outsider-${suffix}`,
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
  const edition = await createEdition({
    tenantId: scenario.tenant.id,
    cityId: scenario.city.id,
    adminId: admin.id,
    suffix,
  })
  const offer = await createOffer({
    tenantId: scenario.tenant.id,
    editionId: edition.id,
    establishmentId: establishment.id,
    actorId: scenario.owner.id,
    suffix,
    maxRedemptions,
  })
  const access = await createAccess({
    tenantId: scenario.tenant.id,
    editionId: edition.id,
    userId: consumer.id,
    adminId: admin.id,
  })

  return { scenario, admin, consumer, outsider, establishment, edition, offer, access }
}

async function captureFailure(callback: () => Promise<unknown>): Promise<unknown> {
  try {
    await callback()
    return null
  } catch (error) {
    return error
  }
}

test.group('Benefit redemptions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('issues a short presentation only for the benefit holder', async ({ assert }) => {
    const fixture = await createFixture('holder')
    const service = await app.container.make(BenefitRedemptionService)

    const presentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )

    assert.isTrue(presentation.token.length > 40)
    assert.match(presentation.qr_data_url, /^data:image\/png;base64,/)
    assert.equal(presentation.benefit.access_id, fixture.access.id)
    assert.equal(presentation.benefit.offer_id, fixture.offer.id)
    assert.equal(presentation.benefit.remaining_redemptions, 1)
    assert.equal(presentation.expires_in_seconds, 300)

    const foreignAttempt = await captureFailure(() =>
      service.present(
        fixture.scenario.tenant.id,
        fixture.access.id,
        fixture.offer.id,
        fixture.outsider,
        'http://localhost:3333'
      )
    )
    assert.exists(foreignAttempt)
  })

  test('lets only the owning partner preview and confirm a presentation', async ({ assert }) => {
    const fixture = await createFixture('confirm')
    const service = await app.container.make(BenefitRedemptionService)
    const presentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )

    const preview = await service.preview(
      fixture.scenario.tenant.id,
      presentation.token,
      fixture.scenario.owner
    )
    assert.equal(preview.holder.id, fixture.consumer.id)
    assert.equal(preview.benefit.establishment_id, fixture.establishment.id)
    assert.equal(preview.benefit.organization_id, fixture.scenario.organization.id)

    const platformPreview = await service.preview(
      fixture.scenario.tenant.id,
      presentation.token,
      fixture.admin
    )
    assert.equal(platformPreview.benefit.organization_id, fixture.scenario.organization.id)
    const platformRoot = await createUser({
      prefix: 'redemption-platform-root',
      tenant: fixture.scenario.tenant,
      globalRole: IRole.Slugs.ROOT,
    })
    const platformRootPreview = await service.preview(
      fixture.scenario.tenant.id,
      presentation.token,
      platformRoot
    )
    assert.equal(platformRootPreview.benefit.organization_id, fixture.scenario.organization.id)

    const organizationAdmin = await createUser({
      prefix: 'redemption-organization-admin',
      tenant: fixture.scenario.tenant,
    })
    const editor = await createUser({
      prefix: 'redemption-editor',
      tenant: fixture.scenario.tenant,
    })
    await addOrganizationMember({
      tenant: fixture.scenario.tenant,
      organization: fixture.scenario.organization,
      user: organizationAdmin,
      role: 'admin',
    })
    await addOrganizationMember({
      tenant: fixture.scenario.tenant,
      organization: fixture.scenario.organization,
      user: editor,
      role: 'editor',
    })

    for (const actor of [organizationAdmin, editor]) {
      const authorizedPreview = await service.preview(
        fixture.scenario.tenant.id,
        presentation.token,
        actor
      )
      assert.equal(authorizedPreview.benefit.organization_id, fixture.scenario.organization.id)
    }

    const analyst = await createUser({
      prefix: 'redemption-analyst',
      tenant: fixture.scenario.tenant,
    })
    await addOrganizationMember({
      tenant: fixture.scenario.tenant,
      organization: fixture.scenario.organization,
      user: analyst,
      role: 'analyst',
    })
    const analystAttempt = await captureFailure(() =>
      service.preview(fixture.scenario.tenant.id, presentation.token, analyst)
    )
    assert.exists(analystAttempt)

    const moderator = await createUser({
      prefix: 'redemption-platform-moderator',
      tenant: fixture.scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const moderatorAttempt = await captureFailure(() =>
      service.preview(fixture.scenario.tenant.id, presentation.token, moderator)
    )
    assert.exists(moderatorAttempt)

    const outsiderAttempt = await captureFailure(() =>
      service.preview(fixture.scenario.tenant.id, presentation.token, fixture.outsider)
    )
    assert.exists(outsiderAttempt)

    const receipt = await service.redeem(
      fixture.scenario.tenant.id,
      presentation.token,
      fixture.scenario.owner
    )
    assert.match(receipt.receipt_code, /^EXP-[0-9A-F]{16}$/)
    assert.equal(receipt.holder.id, fixture.consumer.id)
    assert.equal(receipt.offer.id, fixture.offer.id)
  })

  test('keeps confirmation idempotent and serializes the redemption limit', async ({ assert }) => {
    const fixture = await createFixture('idempotent', 2)
    const service = await app.container.make(BenefitRedemptionService)

    const firstPresentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )
    const firstReceipt = await service.redeem(
      fixture.scenario.tenant.id,
      firstPresentation.token,
      fixture.scenario.owner
    )
    const replayReceipt = await service.redeem(
      fixture.scenario.tenant.id,
      firstPresentation.token,
      fixture.scenario.owner
    )
    assert.equal(replayReceipt.id, firstReceipt.id)

    const secondPresentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )
    const secondReceipt = await service.redeem(
      fixture.scenario.tenant.id,
      secondPresentation.token,
      fixture.scenario.owner
    )
    assert.equal(secondReceipt.redemption_number, 2)

    const exhaustedAttempt = await captureFailure(() =>
      service.present(
        fixture.scenario.tenant.id,
        fixture.access.id,
        fixture.offer.id,
        fixture.consumer,
        'http://localhost:3333'
      )
    )
    assert.exists(exhaustedAttempt)

    const rows = await BenefitRedemption.query()
      .where('tenant_id', fixture.scenario.tenant.id)
      .where('access_id', fixture.access.id)
      .where('offer_id', fixture.offer.id)
      .orderBy('redemption_number', 'asc')
    assert.lengthOf(rows, 2)
    assert.deepEqual(
      rows.map((row) => row.redemption_number),
      [1, 2]
    )
  })

  test('projects redeemed benefits and keeps receipts private', async ({ assert }) => {
    const fixture = await createFixture('history')
    const service = await app.container.make(BenefitRedemptionService)
    const presentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )
    const receipt = await service.redeem(
      fixture.scenario.tenant.id,
      presentation.token,
      fixture.scenario.owner
    )
    const originalTerms = fixture.offer.terms
    assert.equal(receipt.offer.terms, originalTerms)

    fixture.offer.terms = 'Termos alterados depois da utilização.'
    await fixture.offer.save()

    const holderHistory = await service.holderHistory(fixture.scenario.tenant.id, fixture.consumer)
    assert.equal(holderHistory.total, 1)
    assert.equal(holderHistory.redemptions[0].receipt_code, receipt.receipt_code)
    assert.equal(holderHistory.redemptions[0].offer.terms, originalTerms)

    const organizationAdmin = await createUser({
      prefix: 'redemption-history-organization-admin',
      tenant: fixture.scenario.tenant,
    })
    const editor = await createUser({
      prefix: 'redemption-history-editor',
      tenant: fixture.scenario.tenant,
    })
    const analyst = await createUser({
      prefix: 'redemption-history-analyst',
      tenant: fixture.scenario.tenant,
    })
    const members = [
      { actor: fixture.scenario.owner, role: 'owner' as const },
      { actor: organizationAdmin, role: 'admin' as const },
      { actor: editor, role: 'editor' as const },
      { actor: analyst, role: 'analyst' as const },
    ]

    for (const member of members.slice(1)) {
      await addOrganizationMember({
        tenant: fixture.scenario.tenant,
        organization: fixture.scenario.organization,
        user: member.actor,
        role: member.role,
      })
    }

    for (const { actor } of members) {
      const history = await service.partnerHistory(fixture.scenario.tenant.id, actor)
      assert.equal(history.total, 1)
      const organizationReceipt = await service.partnerReceipt(
        fixture.scenario.tenant.id,
        receipt.receipt_code,
        actor
      )
      assert.equal(organizationReceipt.receipt_code, receipt.receipt_code)
    }

    const platformRoot = await createUser({
      prefix: 'redemption-history-platform-root',
      tenant: fixture.scenario.tenant,
      globalRole: IRole.Slugs.ROOT,
    })
    for (const actor of [fixture.admin, platformRoot]) {
      const platformHistory = await service.partnerHistory(fixture.scenario.tenant.id, actor)
      assert.equal(platformHistory.total, 1)
      const platformReceipt = await service.partnerReceipt(
        fixture.scenario.tenant.id,
        receipt.receipt_code,
        actor
      )
      assert.equal(platformReceipt.receipt_code, receipt.receipt_code)
    }

    const moderator = await createUser({
      prefix: 'redemption-history-platform-moderator',
      tenant: fixture.scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    for (const actor of [fixture.outsider, moderator]) {
      assert.exists(
        await captureFailure(() => service.partnerHistory(fixture.scenario.tenant.id, actor))
      )
      assert.exists(
        await captureFailure(() =>
          service.partnerReceipt(fixture.scenario.tenant.id, receipt.receipt_code, actor)
        )
      )
    }

    const foreignFixture = await createFixture('history-cross-tenant')
    assert.exists(
      await captureFailure(() =>
        service.partnerHistory(fixture.scenario.tenant.id, foreignFixture.scenario.owner)
      )
    )
    assert.exists(
      await captureFailure(() =>
        service.partnerReceipt(
          foreignFixture.scenario.tenant.id,
          receipt.receipt_code,
          foreignFixture.scenario.owner
        )
      )
    )

    const foreignReceipt = await captureFailure(() =>
      service.holderReceipt(fixture.scenario.tenant.id, receipt.receipt_code, fixture.outsider)
    )
    assert.exists(foreignReceipt)
  })

  test('renders the consumer and partner redemption surfaces', async ({ client, assert }) => {
    const fixture = await createFixture('pages')
    const service = await app.container.make(BenefitRedemptionService)
    const presentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )

    const presentationPage = await client
      .get(`/wallet/accesses/${fixture.access.id}/offers/${fixture.offer.id}/use`)
      .header('x-tenant-id', String(fixture.scenario.tenant.id))
      .loginAs(fixture.consumer)
    presentationPage.assertStatus(200)
    assert.include(presentationPage.text(), 'wallet/present')

    const walletHistory = await client
      .get('/wallet/history')
      .header('x-tenant-id', String(fixture.scenario.tenant.id))
      .loginAs(fixture.consumer)
    walletHistory.assertStatus(200)
    assert.include(walletHistory.text(), 'wallet/redemptions')

    const partnerValidation = await client
      .get(`/portal/redemptions/validate?token=${encodeURIComponent(presentation.token)}`)
      .header('x-tenant-id', String(fixture.scenario.tenant.id))
      .loginAs(fixture.scenario.owner)
    partnerValidation.assertStatus(200)
    assert.include(partnerValidation.text(), 'portal/redemptions/validate')
    assert.include(partnerValidation.text(), fixture.offer.title)

    const partnerHistory = await client
      .get('/portal/redemptions')
      .header('x-tenant-id', String(fixture.scenario.tenant.id))
      .loginAs(fixture.scenario.owner)
    partnerHistory.assertStatus(200)
    assert.include(partnerHistory.text(), 'portal/redemptions/index')
  })

  test('rejects tampered and cross-tenant presentation tokens', async ({ assert }) => {
    const fixture = await createFixture('token')
    const other = await createFixture('other-operation')
    const service = await app.container.make(BenefitRedemptionService)
    const presentation = await service.present(
      fixture.scenario.tenant.id,
      fixture.access.id,
      fixture.offer.id,
      fixture.consumer,
      'http://localhost:3333'
    )

    const tamperedAttempt = await captureFailure(() =>
      service.preview(fixture.scenario.tenant.id, `${presentation.token}x`, fixture.scenario.owner)
    )
    assert.exists(tamperedAttempt)

    const crossTenantAttempt = await captureFailure(() =>
      service.preview(other.scenario.tenant.id, presentation.token, other.scenario.owner)
    )
    assert.exists(crossTenantAttempt)
  })
})

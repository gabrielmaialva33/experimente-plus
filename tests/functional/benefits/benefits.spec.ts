import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import City from '#modules/geography/models/city'
import Permission from '#modules/permissions/models/permission'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

async function createPublishedEstablishment(options: {
  tenantId: number
  organizationId: number
  cityId: number
  ownerId: number
  reviewerId: number
  suffix: string
}) {
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
    public_name: `Café participante ${options.suffix}`,
    slug: `cafe-participante-${options.suffix}`,
    short_description: 'Uma unidade publicada para o piloto de benefícios.',
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
    review_notes: 'Publicação preparada pelo cenário funcional.',
    rules_version: 2,
  })

  establishment.published_revision_id = revision.id
  await establishment.save()
  return establishment
}

function editionPayload(cityId: number) {
  return {
    city_id: cityId,
    name: 'Experimente a cidade 2026/2027',
    description: 'Edição regional para validar benefícios dos parceiros.',
    price_cents: 14990,
    currency: 'BRL',
    sales_starts_at: '2026-09-01T09:00:00-03:00',
    sales_ends_at: '2026-12-20T23:59:00-03:00',
    usage_starts_at: '2026-09-15T00:00:00-03:00',
    usage_ends_at: '2027-06-30T23:59:00-03:00',
  }
}

function parseInertiaProps<T>(response: { text(): string }, component: string): T {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  const page = JSON.parse(match[1]) as { component: string; props: unknown }
  if (page.component !== component) {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return page.props as T
}

test.group('Benefits', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('allows only operation administrators to create editions', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('benefit-edition')
    const admin = await createUser({
      prefix: 'benefit-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })

    const forbidden = await client
      .post('/api/v1/admin/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json(editionPayload(scenario.city.id))
    forbidden.assertStatus(403)

    const created = await client
      .post('/api/v1/admin/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(editionPayload(scenario.city.id))
    created.assertStatus(201)
    assert.equal(created.body().status, 'draft')
    assert.equal(created.body().slug, 'experimente-a-cidade-2026-2027')
    assert.equal(created.body().city.id, scenario.city.id)

    const available = await client
      .get('/api/v1/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    available.assertStatus(200)
    assert.deepEqual(
      available.body().map((edition: { id: number }) => edition.id),
      [created.body().id]
    )
  })

  test('projects available editions and Portal offers without private metadata', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('benefit-available-projection')
    const admin = await createUser({
      prefix: 'benefit-available-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const requestedEstablishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: scenario.city.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'available-requested',
    })
    const unrelatedEstablishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: scenario.city.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'available-unrelated',
    })
    const edition = await BenefitEdition.create({
      tenant_id: scenario.tenant.id,
      city_id: scenario.city.id,
      name: 'Edição segura',
      slug: 'edicao-segura',
      description: 'Projeção mínima para parceiros.',
      price_cents: 9900,
      currency: 'BRL',
      sales_starts_at: null,
      sales_ends_at: null,
      usage_starts_at: DateTime.utc().plus({ days: 1 }),
      usage_ends_at: DateTime.utc().plus({ months: 6 }),
      status: 'published',
      created_by: admin.id,
      published_at: DateTime.utc(),
      archived_at: null,
    })
    const privateOfferTitle = 'Oferta interna de outra unidade'
    await BenefitOffer.create({
      tenant_id: scenario.tenant.id,
      edition_id: edition.id,
      establishment_id: unrelatedEstablishment.id,
      title: privateOfferTitle,
      description: 'Não pertence à página da unidade solicitada.',
      benefit_type: 'custom',
      discount_percentage: null,
      discount_amount_cents: null,
      terms: 'Termos internos não relacionados.',
      available_weekdays_mask: 127,
      daily_start_time: null,
      daily_end_time: null,
      starts_at: null,
      ends_at: null,
      reservation_required: false,
      on_premise_only: true,
      minimum_party_size: 1,
      max_redemptions_per_access: 1,
      status: 'active',
      created_by: scenario.owner.id,
      activated_at: DateTime.utc(),
      archived_at: null,
    })
    await BenefitOffer.create({
      tenant_id: scenario.tenant.id,
      edition_id: edition.id,
      establishment_id: requestedEstablishment.id,
      title: 'Oferta segura da unidade solicitada',
      description: 'Oferta que deve usar a projeção mínima do Portal.',
      benefit_type: 'custom',
      discount_percentage: null,
      discount_amount_cents: null,
      terms: 'Termos visíveis ao parceiro.',
      available_weekdays_mask: 127,
      daily_start_time: null,
      daily_end_time: null,
      starts_at: null,
      ends_at: null,
      reservation_required: false,
      on_premise_only: true,
      minimum_party_size: 1,
      max_redemptions_per_access: 1,
      status: 'active',
      created_by: scenario.owner.id,
      activated_at: DateTime.utc(),
      archived_at: null,
    })
    const privateExternalReference = 'payment-reference-must-stay-private'
    const privateNotes = 'Observação financeira restrita ao backoffice.'
    await BenefitAccess.create({
      tenant_id: scenario.tenant.id,
      edition_id: edition.id,
      user_id: scenario.owner.id,
      source: 'payment',
      status: 'active',
      external_reference: privateExternalReference,
      notes: privateNotes,
      granted_by: admin.id,
      granted_at: DateTime.utc(),
      revoked_by: null,
      revoked_at: null,
      revocation_reason: null,
    })

    const available = await client
      .get('/api/v1/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    available.assertStatus(200)
    const apiEdition = available
      .body()
      .find((candidate: { id: number }) => candidate.id === edition.id) as Record<string, unknown>
    assert.exists(apiEdition)
    assert.notInclude(Object.keys(apiEdition), 'offers')
    assert.notInclude(Object.keys(apiEdition), 'accesses')
    assert.notInclude(Object.keys(apiEdition), 'created_by')
    assert.notInclude(JSON.stringify(apiEdition), privateOfferTitle)
    assert.notInclude(JSON.stringify(apiEdition), privateExternalReference)
    assert.notInclude(JSON.stringify(apiEdition), privateNotes)

    const portal = await client
      .get(`/portal/establishments/${requestedEstablishment.id}/benefits`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    portal.assertStatus(200)
    const portalProps = parseInertiaProps<{
      editions: Array<Record<string, unknown>>
      offers: Array<
        Record<string, unknown> & {
          edition: Record<string, unknown> & { city: Record<string, unknown> }
        }
      >
    }>(portal, 'portal/establishments/benefits')
    const portalEdition = portalProps.editions.find((candidate) => candidate.id === edition.id)
    assert.exists(portalEdition)
    assert.notInclude(Object.keys(portalEdition!), 'offers')
    assert.notInclude(Object.keys(portalEdition!), 'accesses')
    assert.notInclude(Object.keys(portalEdition!), 'created_by')
    assert.notInclude(JSON.stringify(portalEdition), privateOfferTitle)
    assert.notInclude(JSON.stringify(portalEdition), privateExternalReference)
    assert.notInclude(JSON.stringify(portalEdition), privateNotes)
    assert.notInclude(JSON.stringify(portalProps.offers), privateOfferTitle)
    assert.notInclude(JSON.stringify(portalProps.offers), privateExternalReference)
    assert.notInclude(JSON.stringify(portalProps.offers), privateNotes)

    const portalOffer = portalProps.offers.find(
      (candidate) => candidate.title === 'Oferta segura da unidade solicitada'
    )
    assert.exists(portalOffer)
    assert.sameMembers(Object.keys(portalOffer!), [
      'id',
      'edition_id',
      'title',
      'description',
      'benefit_type',
      'discount_percentage',
      'discount_amount_cents',
      'terms',
      'available_weekdays_mask',
      'daily_start_time',
      'daily_end_time',
      'reservation_required',
      'on_premise_only',
      'minimum_party_size',
      'max_redemptions_per_access',
      'status',
      'edition',
    ])
    assert.sameMembers(Object.keys(portalOffer!.edition), [
      'id',
      'name',
      'status',
      'currency',
      'usage_starts_at',
      'usage_ends_at',
      'city',
    ])
    assert.sameMembers(Object.keys(portalOffer!.edition.city), ['id', 'name', 'state_code'])
    assert.notInclude(Object.keys(portalOffer!.edition), 'created_by')
    assert.notInclude(Object.keys(portalOffer!.edition), 'tenant_id')
  })

  test('completes edition and offer workflow with explicit state transitions', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('benefit-workflow')
    const admin = await createUser({
      prefix: 'workflow-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const establishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: scenario.city.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'workflow',
    })

    const editionResponse = await client
      .post('/api/v1/admin/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(editionPayload(scenario.city.id))
    editionResponse.assertStatus(201)
    const editionId = Number(editionResponse.body().id)

    const emptyPublish = await client
      .post(`/api/v1/admin/benefit-editions/${editionId}/publish`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
    emptyPublish.assertStatus(400)

    const offerResponse = await client
      .post(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: editionId,
        title: 'Peça um café especial e ganhe outro',
        description: 'O segundo café deve ter valor igual ou menor ao primeiro.',
        benefit_type: 'buy_one_get_one',
        terms: 'Válido de terça a sexta, exceto feriados.',
        available_weekdays_mask: 60,
        daily_start_time: '14:00',
        daily_end_time: '18:00',
        reservation_required: false,
        on_premise_only: true,
        minimum_party_size: 2,
      })
    offerResponse.assertStatus(201)
    assert.equal(offerResponse.body().status, 'draft')

    const duplicate = await client
      .post(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: editionId,
        title: 'Oferta duplicada',
        description: 'Esta oferta deve ser recusada pelo domínio.',
        benefit_type: 'custom',
      })
    duplicate.assertStatus(400)

    const offerId = Number(offerResponse.body().id)
    const activate = await client
      .post(`/api/v1/benefit-offers/${offerId}/activate`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    activate.assertStatus(200)
    assert.equal(activate.body().status, 'active')

    const activeEdit = await client
      .put(`/api/v1/benefit-offers/${offerId}`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ title: 'Mudança silenciosa' })
    activeEdit.assertStatus(400)

    const publish = await client
      .post(`/api/v1/admin/benefit-editions/${editionId}/publish`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
    publish.assertStatus(200)
    assert.equal(publish.body().status, 'published')

    const pauseOffer = await client
      .post(`/api/v1/benefit-offers/${offerId}/pause`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    pauseOffer.assertStatus(200)

    const update = await client
      .put(`/api/v1/benefit-offers/${offerId}`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        title: '25% de desconto no café especial',
        benefit_type: 'percentage',
        discount_percentage: 25,
        discount_amount_cents: null,
      })
    update.assertStatus(200)
    assert.equal(update.body().benefit_type, 'percentage')
    assert.equal(update.body().discount_percentage, 25)

    const reactivate = await client
      .post(`/api/v1/benefit-offers/${offerId}/activate`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    reactivate.assertStatus(200)

    const edition = await BenefitEdition.findOrFail(editionId)
    const offer = await BenefitOffer.findOrFail(offerId)
    assert.equal(edition.status, 'published')
    assert.equal(offer.status, 'active')
  })

  test('rejects unpublished units, city mismatches and organization IDOR', async ({ client }) => {
    const scenario = await createEstablishmentScenario('benefit-integrity')
    const admin = await createUser({
      prefix: 'integrity-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const outsider = await createUser({ prefix: 'integrity-outsider', tenant: scenario.tenant })
    const edition = await client
      .post('/api/v1/admin/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(editionPayload(scenario.city.id))
    edition.assertStatus(201)

    const unpublished = await Establishment.create({
      tenant_id: scenario.tenant.id,
      organization_id: scenario.organization.id,
      lifecycle_status: 'active',
      business_status: 'open',
      published_revision_id: null,
      created_by: scenario.owner.id,
    })
    const unpublishedOffer = await client
      .post(`/api/v1/establishments/${unpublished.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: edition.body().id,
        title: 'Oferta prematura',
        description: 'Não deve existir antes da publicação da unidade.',
        benefit_type: 'custom',
      })
    unpublishedOffer.assertStatus(400)

    const otherCity = await City.create({
      tenant_id: scenario.tenant.id,
      region_id: scenario.region.id,
      name: 'Outra cidade',
      slug: 'outra-cidade-benefit-integrity',
      state_code: 'PR',
      country_code: 'BR',
      ibge_code: null,
      timezone: 'America/Sao_Paulo',
      latitude: -23.3,
      longitude: -51.1,
      sort_order: 1,
      is_active: true,
    })
    const establishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: otherCity.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'other-city',
    })

    const mismatch = await client
      .post(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: edition.body().id,
        title: 'Oferta em cidade incompatível',
        description: 'A cidade publicada não coincide com a edição.',
        benefit_type: 'custom',
      })
    mismatch.assertStatus(400)

    const hidden = await client
      .get(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(outsider)
    hidden.assertStatus(404)
  })

  test('validates typed benefit values before persistence', async ({ client }) => {
    const scenario = await createEstablishmentScenario('benefit-values')
    const admin = await createUser({
      prefix: 'values-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const establishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: scenario.city.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'values',
    })
    const edition = await client
      .post('/api/v1/admin/benefit-editions')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(editionPayload(scenario.city.id))
    edition.assertStatus(201)

    const invalidPercentage = await client
      .post(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: edition.body().id,
        title: 'Percentual incompleto',
        description: 'Percentual sem valor precisa ser recusado.',
        benefit_type: 'percentage',
      })
    invalidPercentage.assertStatus(400)

    const invalidCustom = await client
      .post(`/api/v1/establishments/${establishment.id}/benefit-offers`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        edition_id: edition.body().id,
        title: 'Custom com percentual',
        description: 'Modalidade custom não aceita percentual estruturado.',
        benefit_type: 'custom',
        discount_percentage: 10,
      })
    invalidCustom.assertStatus(400)
  })
  test('renders responsive operation and partner benefit surfaces', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('benefit-pages')
    const admin = await createUser({
      prefix: 'pages-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const establishment = await createPublishedEstablishment({
      tenantId: scenario.tenant.id,
      organizationId: scenario.organization.id,
      cityId: scenario.city.id,
      ownerId: scenario.owner.id,
      reviewerId: admin.id,
      suffix: 'pages',
    })

    const backoffice = await client
      .get('/backoffice/benefits')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
    backoffice.assertStatus(200)
    assert.include(backoffice.text(), 'backoffice/benefits/index')

    const partner = await client
      .get(`/portal/establishments/${establishment.id}/benefits`)
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.owner)
    partner.assertStatus(200)
    assert.include(partner.text(), 'portal/establishments/benefits')
    assert.include(partner.text(), 'Café participante pages')
  })

  test('lets moderators inspect editions while keeping mutations admin-only', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('benefit-moderator-read')
    const moderator = await createUser({
      prefix: 'benefit-moderator-read',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
      tenantRole: 'member',
    })

    const backoffice = await client
      .get('/backoffice/benefits')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(moderator)

    backoffice.assertStatus(200)
    assert.include(backoffice.text(), 'backoffice/benefits/index')

    const createAttempt = await client
      .post('/backoffice/benefits')
      .withCsrfToken()
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(moderator)
      .json(editionPayload(scenario.city.id))

    createAttempt.assertStatus(403)
  })

  test('allows operation staff with update but without create to open the edition workspace', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('benefit-update-only')
    const admin = await createUser({
      prefix: 'benefit-update-only-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
      tenantRole: 'admin',
    })
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const createPermission = await Permission.findByOrFail('name', 'benefit_editions.create')
    await adminRole.related('permissions').detach([createPermission.id])

    const response = await client
      .get('/backoffice/benefits')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)

    response.assertStatus(200)
    assert.include(response.text(), 'backoffice/benefits/index')

    const createAttempt = await client
      .post('/backoffice/benefits')
      .withCsrfToken()
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(admin)
      .json(editionPayload(scenario.city.id))

    createAttempt.assertStatus(403)
  })
})

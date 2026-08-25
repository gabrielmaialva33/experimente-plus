import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function createDraftEstablishment(client: ApiClient, scenario: EstablishmentScenario) {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: 'Unidade do portal',
      city_id: scenario.city.id,
      short_description: 'Unidade criada para validar o portal operacional do parceiro.',
      public_phone: '(43) 99999-0000',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

test.group('Operational portals', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('renders the partner overview, organization and establishment editor for members', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('portal-member')
    const establishmentId = await createDraftEstablishment(client, scenario)

    const overview = await client
      .get('/portal')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    overview.assertStatus(200)
    assert.include(overview.text(), 'portal/index')
    assert.include(overview.text(), scenario.organization.trade_name)
    assert.equal(overview.header('cache-control'), 'private, no-store')
    assert.equal(overview.header('x-robots-tag'), 'noindex, nofollow')

    const organization = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    organization.assertStatus(200)
    assert.include(organization.text(), 'portal/organizations/show')
    assert.equal(organization.header('cache-control'), 'private, no-store')
    assert.equal(organization.header('x-robots-tag'), 'noindex, nofollow')

    const establishment = await client
      .get(`/portal/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    establishment.assertStatus(200)
    assert.include(establishment.text(), 'portal/establishments/edit')
    assert.equal(establishment.header('cache-control'), 'private, no-store')
    assert.equal(establishment.header('x-robots-tag'), 'noindex, nofollow')
  })

  test('keeps organization and establishment pages hidden from outsiders', async ({ client }) => {
    const scenario = await createEstablishmentScenario('portal-outsider')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const outsider = await createUser({
      prefix: 'portal-outsider-user',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const organization = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    organization.assertStatus(404)

    const establishment = await client
      .get(`/portal/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    establishment.assertStatus(404)
  })

  test('separates moderation and pilot feedback backoffice capabilities', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('portal-backoffice')
    const moderator = await createUser({
      prefix: 'portal-moderator',
      tenant: scenario.tenant,
      tenantRole: 'member',
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const admin = await createUser({
      prefix: 'portal-admin',
      tenant: scenario.tenant,
      tenantRole: 'admin',
      globalRole: IRoles.Slugs.ADMIN,
    })

    const partnerQueue = await client
      .get('/backoffice/moderation')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    partnerQueue.assertStatus(403)

    const moderatorQueue = await client
      .get('/backoffice/moderation')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    moderatorQueue.assertStatus(200)
    assert.include(moderatorQueue.text(), 'backoffice/moderation/index')
    assert.equal(moderatorQueue.header('cache-control'), 'private, no-store')
    assert.equal(moderatorQueue.header('x-robots-tag'), 'noindex, nofollow')

    const moderatorFeedback = await client
      .get('/backoffice/feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    moderatorFeedback.assertStatus(403)

    const adminFeedback = await client
      .get('/backoffice/feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
    adminFeedback.assertStatus(200)
    assert.include(adminFeedback.text(), 'backoffice/feedback/index')
  })
})

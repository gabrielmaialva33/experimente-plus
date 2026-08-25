import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import PilotFeedback from '#modules/pilot_feedback/models/pilot_feedback'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createOrganization, createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function createDraftEstablishment(client: ApiClient, scenario: EstablishmentScenario) {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: 'Unidade do piloto',
      city_id: scenario.city.id,
      short_description: 'Unidade criada para validar o feedback estruturado do piloto.',
      public_phone: '(43) 99999-0000',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

test.group('Pilot feedback', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('records organization feedback only for an active organization member', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pilot-feedback-create')

    const response = await client
      .post('/api/v1/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        context: 'organization',
        rating: 4,
        message:
          'O onboarding ficou claro, mas a revisão de dados legais precisa de mais contexto.',
        organization_id: scenario.organization.id,
      })

    response.assertStatus(201)
    response.assertBodyContains({
      context: 'organization',
      rating: 4,
      status: 'new',
      organization_id: scenario.organization.id,
    })

    const stored = await PilotFeedback.query()
      .where('tenant_id', scenario.tenant.id)
      .where('organization_id', scenario.organization.id)
      .firstOrFail()

    assert.equal(stored.user_id, scenario.owner.id)
    assert.isNull(stored.reviewed_by)
  })

  test('hides organization and establishment targets from outsiders', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pilot-feedback-scope')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const outsider = await createUser({
      prefix: 'pilot-feedback-outsider',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const response = await client
      .post('/api/v1/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
      .json({
        context: 'establishment',
        rating: 3,
        message: 'Tentativa de associar feedback a uma unidade sem membership válida.',
        organization_id: scenario.organization.id,
        establishment_id: establishmentId,
      })

    response.assertStatus(404)
  })

  test('allows administrators to review feedback and denies partners and moderators', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pilot-feedback-review')

    const created = await client
      .post('/api/v1/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        context: 'analytics',
        rating: 5,
        message: 'O painel mostra de forma simples quais unidades estão gerando contato.',
        organization_id: scenario.organization.id,
      })
    created.assertStatus(201)
    const feedbackId = Number(created.body().id)

    const admin = await createUser({
      prefix: 'pilot-feedback-admin',
      tenant: scenario.tenant,
      tenantRole: 'admin',
      globalRole: IRoles.Slugs.ADMIN,
    })
    const moderator = await createUser({
      prefix: 'pilot-feedback-moderator',
      tenant: scenario.tenant,
      tenantRole: 'member',
      globalRole: IRoles.Slugs.MODERATOR,
    })

    const partnerList = await client
      .get('/api/v1/admin/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    partnerList.assertStatus(403)

    const moderatorList = await client
      .get('/api/v1/admin/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    moderatorList.assertStatus(403)

    const adminList = await client
      .get('/api/v1/admin/pilot-feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
    adminList.assertStatus(200)

    const reviewed = await client
      .patch(`/api/v1/admin/pilot-feedback/${feedbackId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
      .json({
        status: 'resolved',
        internal_notes: 'Validado no piloto regional e incorporado ao backlog.',
      })

    reviewed.assertStatus(200)
    assert.equal(Number(reviewed.body().id), feedbackId)
    assert.equal(reviewed.body().status, 'resolved')

    const stored = await PilotFeedback.findOrFail(feedbackId)
    assert.equal(stored.reviewed_by, admin.id)
    assert.equal(stored.status, 'resolved')
  })

  test('enforces target, rating and review-state invariants in PostgreSQL', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pilot-feedback-db')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const otherOrganization = await createOrganization({
      tenant: scenario.tenant,
      owner: null,
      status: 'active',
      prefix: 'Pilot Feedback Foreign Organization',
    })

    const base = {
      tenant_id: scenario.tenant.id,
      user_id: scenario.owner.id,
      organization_id: scenario.organization.id,
      establishment_id: establishmentId,
      context: 'establishment',
      rating: 4,
      message: 'Feedback válido usado como base para testar constraints do banco.',
      status: 'new',
    }

    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx.table('pilot_feedback').insert({
          ...base,
          organization_id: otherOrganization.id,
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx.table('pilot_feedback').insert({
          ...base,
          organization_id: null,
          establishment_id: null,
          context: 'general',
          rating: 6,
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx.table('pilot_feedback').insert({
          ...base,
          organization_id: null,
          establishment_id: null,
          context: 'general',
          status: 'resolved',
          reviewed_by: null,
          reviewed_at: null,
        })
      })
    )
  })
})

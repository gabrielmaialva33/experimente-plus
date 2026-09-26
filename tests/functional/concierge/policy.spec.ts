import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import ConciergeProviderFactory from '#modules/concierge/services/concierge_provider_factory'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
})

/**
 * A provider that answers every question with the first item it was offered,
 * and counts the calls. The count is the point: what the policy promises is
 * about whether a model is consulted, and only a provider we own can say so.
 */
class RecordingFactory extends ConciergeProviderFactory {
  calls = 0

  make(): IConcierge.Provider {
    return {
      name: 'recording',
      complete: async (request) => {
        this.calls += 1
        const ref = /^- (\w+:\d+) /m.exec(request.user)?.[1]
        return {
          model: request.model,
          content: JSON.stringify({ intro: 'Sugestão', steps: [{ ref, why: 'Combina' }] }),
        }
      },
    }
  }

  models() {
    return ['recording-model']
  }
}

async function operation(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  await createPublishedEstablishment(scenario, 'Alfa Café')
  await createPublishedEstablishment(scenario, 'Beta Bistrô')
  const admin = await createUser({
    prefix: `${prefix}-admin`,
    tenant: scenario.tenant,
    tenantRole: 'admin',
    globalRole: IRoles.Slugs.ADMIN,
  })
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
  const explorer = await createUser({ prefix: `${prefix}-explorer`, tenant: scenario.tenant })
  return { scenario, admin, moderator, explorer, headers: tenantHeader(scenario.tenant.id) }
}

test.group('Concierge policy — administration (ADR-0029, 26/09/2026)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an administrator reads the provisional defaults and changes them', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, headers } = await operation('cp-admin')

    const read = await client.get('/api/v1/admin/concierge-policy').headers(headers).loginAs(admin)
    read.assertStatus(200)
    read.assertBodyContains({
      tenant_id: scenario.tenant.id,
      enabled: true,
      max_catalog_items: 20,
      daily_questions_per_person: 20,
    })
    assert.equal(read.header('cache-control'), 'private, no-store')

    const updated = await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ enabled: false, max_catalog_items: 12 })
    updated.assertStatus(200)
    updated.assertBodyContains({
      enabled: false,
      max_catalog_items: 12,
      daily_questions_per_person: 20,
    })
  })

  test('only a platform administrator reads or changes it', async ({ client }) => {
    const { scenario, moderator, explorer, headers } = await operation('cp-guard')

    for (const outsider of [moderator, explorer, scenario.owner]) {
      const read = await client
        .get('/api/v1/admin/concierge-policy')
        .headers(headers)
        .loginAs(outsider)
      read.assertStatus(403)
      const write = await client
        .put('/api/v1/admin/concierge-policy')
        .headers(headers)
        .loginAs(outsider)
        .json({ enabled: false })
      write.assertStatus(403)
    }

    const anonymous = await client.get('/api/v1/admin/concierge-policy').headers(headers)
    anonymous.assertStatus(401)
  })

  test('refuses values outside the ranges the assistant was measured against', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, headers } = await operation('cp-range')

    for (const payload of [
      { max_catalog_items: 7 },
      { max_catalog_items: 41 },
      { max_catalog_items: 12.5 },
      { daily_questions_per_person: 0 },
      { daily_questions_per_person: 201 },
      { enabled: 'sometimes' },
    ]) {
      const refused = await client
        .put('/api/v1/admin/concierge-policy')
        .headers(headers)
        .loginAs(admin)
        .json(payload)
      refused.assertStatus(422)
    }

    // Nothing refused reached the table, and the table itself holds the range.
    assert.isNull(
      await db.from('concierge_policies').where('tenant_id', scenario.tenant.id).first()
    )
    await assert.rejects(() =>
      db
        .table('concierge_policies')
        .insert({ tenant_id: scenario.tenant.id, max_catalog_items: 100 })
    )
  })

  test("one operation's policy never touches another's", async ({ client, assert }) => {
    const alpha = await operation('cp-alpha')
    const beta = await operation('cp-beta')

    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(alpha.headers)
      .loginAs(alpha.admin)
      .json({ daily_questions_per_person: 3 })

    const inBeta = await client
      .get('/api/v1/admin/concierge-policy')
      .headers(beta.headers)
      .loginAs(beta.admin)
    assert.equal(inBeta.body().tenant_id, beta.scenario.tenant.id)
    assert.equal(inBeta.body().daily_questions_per_person, 20)
  })

  test('the screen is for administrators and shows the infrastructure without the key', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, moderator, headers } = await operation('cp-screen')

    for (const outsider of [scenario.owner, moderator]) {
      const denied = await client.get('/backoffice/concierge').headers(headers).loginAs(outsider)
      denied.assertStatus(403)
    }

    const html = await client.get('/backoffice/concierge').headers(headers).loginAs(admin)
    html.assertStatus(200)
    assert.equal(html.header('cache-control'), 'private, no-store')
    assert.equal(html.header('x-robots-tag'), 'noindex, nofollow')
    assert.include(html.text(), 'backoffice/concierge/index')
    assert.include(html.text(), '"daily_questions_per_person"')
    assert.include(html.text(), '"provider_configured"')
    assert.notMatch(html.text(), /api_key|apiKey|NVIDIA_API_KEY/)
  })

  test('saving through the screen persists through the same rules as the API', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, headers } = await operation('cp-save')

    const saved = await client
      .put('/backoffice/concierge')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ enabled: false, max_catalog_items: 10, daily_questions_per_person: 5 })
    assert.oneOf(saved.status(), [200, 302])

    const row = await db.from('concierge_policies').where('tenant_id', scenario.tenant.id).first()
    assert.isFalse(row.enabled)
    assert.equal(row.max_catalog_items, 10)
    assert.equal(row.daily_questions_per_person, 5)

    const refused = await client
      .put('/backoffice/concierge')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ max_catalog_items: 99 })
    assert.notEqual(refused.status(), 500)
    const unchanged = await db
      .from('concierge_policies')
      .where('tenant_id', scenario.tenant.id)
      .first()
    assert.equal(unchanged.max_catalog_items, 10)
  })
})

test.group('Concierge policy — enforcement (ADR-0029, 26/09/2026)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let provider: RecordingFactory
  group.each.setup(() => {
    provider = new RecordingFactory()
    app.container.swap(ConciergeProviderFactory, () => provider)
    return () => app.container.restore(ConciergeProviderFactory)
  })

  const ask = (client: any, headers: Record<string, string>, user: any, question: string) =>
    client.post('/api/v1/me/concierge').headers(headers).loginAs(user).json({ question })

  test('with the default policy a model is consulted', async ({ client, assert }) => {
    const { explorer, headers } = await operation('cp-baseline')

    const reply = await ask(client, headers, explorer, 'Onde tomar um café?')
    reply.assertStatus(200)
    assert.equal(reply.body().outcome, 'grounded')
    assert.equal(provider.calls, 1)
  })

  test('switched off, both routes answer with the catalogue and no model', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, explorer, headers } = await operation('cp-off')
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ enabled: false })

    const personal = await ask(client, headers, explorer, 'Onde tomar um café?')
    const visitor = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde tomar um café?' })

    for (const reply of [personal, visitor]) {
      reply.assertStatus(200)
      assert.equal(reply.body().outcome, 'degraded')
      assert.isNull(reply.body().model)
      assert.lengthOf(reply.body().items, 2)
    }
    assert.equal(provider.calls, 0)
  })

  test('past the daily quota a person gets the catalogue without a model call', async ({
    client,
    assert,
  }) => {
    const { admin, explorer, headers, scenario } = await operation('cp-quota')
    const neighbour = await createUser({ prefix: 'cp-quota-neighbour', tenant: scenario.tenant })
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ daily_questions_per_person: 2 })

    const outcomes = []
    for (let question = 0; question < 3; question++) {
      const reply = await ask(client, headers, explorer, 'Onde tomar um café?')
      reply.assertStatus(200)
      outcomes.push(reply.body().outcome)
    }
    assert.deepEqual(outcomes, ['grounded', 'grounded', 'degraded'])
    assert.equal(provider.calls, 2)

    // The quota is the person's, not the operation's.
    const other = await ask(client, headers, neighbour, 'Onde tomar um café?')
    assert.equal(other.body().outcome, 'grounded')
    assert.equal(provider.calls, 3)
  })

  test('a refused subject costs nothing, not even a unit of the quota', async ({
    client,
    assert,
  }) => {
    const { admin, explorer, headers } = await operation('cp-refusal')
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ daily_questions_per_person: 1 })

    const refused = await ask(client, headers, explorer, 'preciso de um advogado urgente')
    assert.equal(refused.body().outcome, 'refused')

    const allowed = await ask(client, headers, explorer, 'Onde tomar um café?')
    assert.equal(allowed.body().outcome, 'grounded')
    assert.equal(provider.calls, 1)
  })

  test('the public route is bounded by its throttle, not by the per-person quota', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, explorer, headers } = await operation('cp-public')
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ daily_questions_per_person: 1 })

    await ask(client, headers, explorer, 'Onde tomar um café?')
    const exhausted = await ask(client, headers, explorer, 'Onde tomar um café?')
    assert.equal(exhausted.body().outcome, 'degraded')

    for (let question = 0; question < 2; question++) {
      const visitor = await client
        .post('/api/v1/catalog/concierge')
        .headers(publicHeaders(scenario))
        .loginAs(explorer)
        .json({ question: 'Onde tomar um café?' })
      assert.equal(visitor.body().outcome, 'grounded')
    }
    assert.equal(provider.calls, 3)
  })

  test("the operation's catalogue budget bounds what a question sees", async ({
    client,
    assert,
  }) => {
    const { scenario, admin, explorer, headers } = await operation('cp-budget')
    for (let place = 0; place < 9; place++) {
      await createPublishedEstablishment(scenario, `Lugar ${place} Extra`)
    }
    app.container.restore(ConciergeProviderFactory)

    const roomy = await ask(client, headers, explorer, 'Onde ir hoje?')
    assert.equal(roomy.body().outcome, 'degraded')
    assert.lengthOf(roomy.body().items, 11)

    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ max_catalog_items: 8 })

    const bounded = await ask(client, headers, explorer, 'Onde ir hoje?')
    assert.lengthOf(bounded.body().items, 8)
  })
})

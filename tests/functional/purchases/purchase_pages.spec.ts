import { mock } from 'node:test'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import SimulatePurchase from '../../../commands/simulate_purchase.js'
import { createPurchaseFixture } from '#database/factories/scenarios/purchase_flow_factory'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import type { PurchaseOperationsPageProps } from '#modules/purchases/interfaces/purchase_pages'
import IRole from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'
import env from '#start/env'
import { useFakePayments } from '#tests/helpers/fake_payments'
import { createUser } from '#tests/functional/organizations/helpers'

const LIST = '/backoffice/purchases'

function parseInertiaPage(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]) as { component: string; props: Record<string, unknown> }
}

/** Overrides configuration values for the rest of the test, like the deployment policy specs. */
function configuration(values: Record<string, unknown>) {
  const original = env.get.bind(env)
  mock.method(env, 'get', (key: string, fallback?: string) =>
    Object.hasOwn(values, key) ? values[key] : (original(key as never) ?? fallback)
  )
}

async function scenario() {
  const f = await createPurchaseFixture()
  const pending = await f.create()
  return { f, pending, headers: { 'x-tenant-id': String(f.s.tenant.id) } }
}

function list(client: ApiClient, headers: Record<string, string>, actor: User, query = '') {
  return client.get(`${LIST}${query}`).headers(headers).loginAs(actor)
}

function simulate(client: ApiClient, headers: Record<string, string>, actor: User, id: string) {
  return client
    .post(`${LIST}/${id}/simulate-payment`)
    .headers({ ...headers, referer: LIST })
    .withCsrfToken()
    .redirects(0)
    .loginAs(actor)
}

async function events(purchaseId: string) {
  return db
    .from('purchase_events')
    .where('purchase_id', purchaseId)
    .orderBy('id')
    .select('action', 'actor_id')
}

async function actions(purchaseId: string): Promise<string[]> {
  const history = await events(purchaseId)
  return history.map((event) => event.action)
}

test.group('Back-office orders and simulated payments', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  test('lists the orders of the operation and offers the simulation outside production', async ({
    client,
    assert,
  }) => {
    const { f, pending, headers } = await scenario()

    const response = await list(client, headers, f.s.users.admin)
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'private, no-store')
    const page = parseInertiaPage(response)
    assert.equal(page.component, 'backoffice/purchases/index')
    const props = page.props as unknown as PurchaseOperationsPageProps
    assert.deepEqual(props.simulation, { available: true })
    assert.deepEqual(props.meta, { total: 1, current_page: 1, last_page: 1, per_page: 20 })
    assert.equal(props.counts.pending, 1)
    assert.lengthOf(props.purchases, 1)
    assert.deepInclude(props.purchases[0], {
      id: pending.id,
      status: 'pending',
      simulated: true,
      can_confirm_simulation: true,
      product_type: 'edition',
      method: 'pix',
      has_access: false,
    })
    assert.equal(props.purchases[0].buyer?.full_name, f.s.users.holder.full_name)

    const paid = parseInertiaPage(await list(client, headers, f.s.users.admin, '?status=paid'))
      .props as unknown as PurchaseOperationsPageProps
    assert.lengthOf(paid.purchases, 0)
  })

  test('confirms a simulated payment through the normal reconciliation and audits who did it', async ({
    client,
    assert,
  }) => {
    const { f, pending, headers } = await scenario()

    const confirmed = await simulate(client, headers, f.s.users.admin, pending.id)
    confirmed.assertStatus(302)
    confirmed.assertFlashMessage(
      'success',
      'Pagamento simulado confirmado. O acesso já está na carteira da pessoa.'
    )

    const purchase = (await f.repo.get(pending.id))!
    assert.equal(purchase.status, 'paid')
    assert.isNotNull(purchase.paid_at)
    const access = await BenefitAccess.findOrFail(purchase.access_id!)
    assert.equal(access.source, 'payment')
    assert.equal(access.user_id, f.s.users.holder.id)

    const history = await events(pending.id)
    const requested = history.findIndex((event) => event.action === 'payment_simulation_requested')
    const granted = history.findIndex((event) => event.action === 'access_granted')
    assert.isAtLeast(requested, 0)
    assert.equal(history[requested].actor_id, f.s.users.admin.id)
    // The access is born afterwards, from the reconciliation, never from the request.
    assert.isAbove(granted, requested)
    assert.isNull(history[granted].actor_id)

    const again = await simulate(client, headers, f.s.users.admin, pending.id)
    again.assertStatus(302)
    again.assertFlashMessage(
      'error',
      'Este pedido não está mais aguardando pagamento. Atualize a lista para ver a situação atual.'
    )
    const after = await actions(pending.id)
    assert.lengthOf(
      after.filter((action) => action === 'access_granted'),
      1
    )
  })

  test('is refused, and not offered, when the provider is not the fake one', async ({
    client,
    assert,
  }) => {
    const { f, pending, headers } = await scenario()
    configuration({ PAYMENT_PROVIDER: 'mercado_pago' })

    const props = parseInertiaPage(await list(client, headers, f.s.users.admin))
      .props as unknown as PurchaseOperationsPageProps
    assert.deepEqual(props.simulation, { available: false })
    assert.isFalse(props.purchases[0].can_confirm_simulation)
    assert.notInclude(JSON.stringify(props), 'Confirmar pagamento simulado')

    const refused = await simulate(client, headers, f.s.users.admin, pending.id)
    refused.assertStatus(404)
    assert.equal((await f.repo.get(pending.id))!.status, 'pending')
    assert.notInclude(await actions(pending.id), 'payment_simulation_requested')
  })

  test('is refused, and not offered, in production', async ({ client, assert }) => {
    const { f, pending, headers } = await scenario()
    configuration({ DEPLOYMENT_ENV: 'production' })

    const props = parseInertiaPage(await list(client, headers, f.s.users.admin))
      .props as unknown as PurchaseOperationsPageProps
    assert.deepEqual(props.simulation, { available: false })
    assert.isFalse(props.purchases[0].can_confirm_simulation)

    const refused = await simulate(client, headers, f.s.users.admin, pending.id)
    refused.assertStatus(404)
    assert.equal((await f.repo.get(pending.id))!.status, 'pending')
    assert.isNull((await f.repo.get(pending.id))!.access_id)
    assert.notInclude(await actions(pending.id), 'payment_simulation_requested')
  })

  test('is for platform administrators only', async ({ client, assert }) => {
    const { f, pending, headers } = await scenario()
    const moderator = await createUser({
      prefix: 'orders-moderator',
      tenant: f.s.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })

    for (const actor of [moderator, f.s.users.partner, f.s.users.holder]) {
      const page = await list(client, headers, actor)
      page.assertStatus(403)
      const action = await simulate(client, headers, actor, pending.id)
      action.assertStatus(403)
    }
    assert.equal((await f.repo.get(pending.id))!.status, 'pending')

    const anonymous = await client.get(LIST).redirects(0)
    anonymous.assertStatus(302)
  })

  test('the server command confirms through the same service', async ({ assert }) => {
    const { f, pending } = await scenario()

    const command = await ace.create(SimulatePurchase, [pending.id])
    await command.exec()
    command.assertSucceeded()

    const purchase = (await f.repo.get(pending.id))!
    assert.equal(purchase.status, 'paid')
    assert.isNotNull(purchase.access_id)
  })
})

import { useFakePayments } from '#tests/helpers/fake_payments'
import { mock } from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createPurchaseFixture } from '#database/factories/scenarios/purchase_flow_factory'
import { stripeTransport } from '#tests/helpers/stripe_transport'
import StripeAdapter from '#modules/purchases/adapters/stripe_adapter'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import BenefitAccess from '#modules/benefits/models/benefit_access'

async function setupStripe() {
  const f = await createPurchaseFixture()
  const transport = stripeTransport()
  const port = new StripeAdapter(
    transport.state.account,
    'test',
    randomBytes(32).toString('hex'),
    undefined,
    transport.client
  )
  mock.method(PaymentProviderService.prototype, 'get', () => port)
  const input = {
    ...f.input,
    method: 'card' as const,
    card_token: 'pm_' + randomBytes(12).toString('hex'),
    payment_method_id: 'card',
  }
  return { f, transport, port, input }
}

test.group('Stripe worker reconciliation without webhook or network', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  test('polls authenticated confirmation, grants once and preserves the original purchase replay', async ({
    assert,
  }) => {
    const { f, transport, input } = await setupStripe()
    transport.payment.status = 'processing'
    const key = randomUUID()
    const purchase = await f.service.create(f.s.tenant.id, f.s.users.holder, key, input)
    const observed1 = await f.processor.drain()
    assert.equal(observed1.deferred, 0)
    assert.isNull((await f.repo.get(purchase.id))!.access_id)
    transport.payment.status = 'succeeded'
    transport.state.confirmedAt = Math.floor(Date.now() / 1000)
    const poll = await f.processor.reconcile()
    assert.equal(poll.notifications, 0)
    assert.isAbove(poll.purchases, 0)
    const observed2 = await f.processor.drain()
    assert.equal(observed2.deferred, 0)
    const paid = (await f.repo.get(purchase.id))!
    assert.equal(paid.status, 'paid')
    const observed3 = await BenefitAccess.findOrFail(paid.access_id!)
    assert.equal(observed3.source, 'payment')
    assert.deepEqual(await f.service.create(f.s.tenant.id, f.s.users.holder, key, input), purchase)
    await f.processor.reconcile()
    await f.processor.drain()
    assert.lengthOf(
      await f.repo.events().where({ purchase_id: purchase.id, action: 'access_granted' }),
      1
    )
  })

  test('uses the confirmation event time, never the earlier intent creation, for late payment', async ({
    assert,
  }) => {
    const { f, transport, input } = await setupStripe()
    const purchase = await f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), input)
    const row = (await f.repo.get(purchase.id))!
    transport.state.confirmedAt = Math.floor(row.expires_at.getTime() / 1000) + 5
    await f.processor.drain(1)
    const late = (await f.repo.get(purchase.id))!
    assert.isNull(late.access_id)
    assert.equal(late.status, 'review')
    const refunds = await f.repo.refunds().where('purchase_id', purchase.id)
    assert.lengthOf(refunds, 1)
  })

  test('keeps a durable retry and no access while authenticated confirmation timestamp is unavailable', async ({
    assert,
  }) => {
    const { f, transport, input } = await setupStripe()
    transport.state.eventVisible = false
    const purchase = await f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), input)
    const observed5 = await f.processor.drain(1)
    assert.equal(observed5.deferred, 1)
    assert.isNull((await f.repo.get(purchase.id))!.access_id)
    assert.lengthOf(
      await f.repo.commands().where('purchase_id', purchase.id).where('status', 'pending'),
      1
    )
  })

  test('delivers raw JSON and Stripe-Signature to the adapter, with inbox persistence only', async ({
    assert,
    client,
  }) => {
    const { f, port, input } = await setupStripe()
    const purchase = await f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), input)
    let raw: unknown
    mock.method(
      port,
      'verifyWebhook',
      (headers: Record<string, string | undefined>, body: unknown) => {
        raw = body
        assert.equal(headers['stripe-signature'], 'transport-test-only')
        return { key: randomUUID(), resourceId: 'pi_transport' }
      }
    )
    const response = await client
      .post('/api/v1/payments/webhooks/stripe')
      .header('stripe-signature', 'transport-test-only')
      .json({
        id: 'evt_transport',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_transport' } },
      })
    response.assertStatus(202)
    assert.isString(raw)
    assert.equal(JSON.parse(raw as string).id, 'evt_transport')
    assert.isNull((await f.repo.get(purchase.id))!.access_id)
  })
})

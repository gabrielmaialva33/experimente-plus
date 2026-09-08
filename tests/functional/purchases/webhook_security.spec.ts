import { randomBytes, randomUUID } from 'node:crypto'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { stripeTransport } from '#tests/helpers/stripe_transport'
import StripeAdapter from '#modules/purchases/adapters/stripe_adapter'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import { PaymentConfigurationException } from '#modules/purchases/exceptions'

test.group('Stripe webhook trust and HTTP failure classification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  test('missing signature is 400 even before provider configuration, without inbox writes', async ({
    client,
    assert,
  }) => {
    const before = await db.from('purchase_webhooks').count('* as total').first()
    mock.method(PaymentProviderService.prototype, 'get', () => {
      throw new PaymentConfigurationException('Payment provider configuration is incomplete')
    })
    const response = await client
      .post('/api/v1/payments/webhooks/stripe')
      .json({ id: randomUUID() })
    response.assertStatus(400)
    const after = await db.from('purchase_webhooks').count('* as total').first()
    assert.equal(after.total, before.total)
  })

  test('invalid and expired signatures are 400; signed events enter inbox once and never grant access', async ({
    client,
    assert,
  }) => {
    const transport = stripeTransport()
    const secret = randomBytes(32).toString('hex')
    const port = new StripeAdapter(
      transport.state.account,
      'test',
      randomBytes(32).toString('hex'),
      secret,
      transport.client
    )
    mock.method(PaymentProviderService.prototype, 'get', () => port)
    const payload = {
      id: 'evt_' + randomBytes(12).toString('hex'),
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { object: 'payment_intent', id: transport.payment.id } },
    }
    const raw = JSON.stringify(payload)
    const before = await db.from('purchase_webhooks').count('* as total').first()
    const accessesBefore = await db.from('benefit_accesses').count('* as total').first()
    for (const signature of [
      'invalid',
      transport.client.webhooks.generateTestHeaderString({
        payload: raw,
        secret: randomBytes(32).toString('hex'),
      }),
      transport.client.webhooks.generateTestHeaderString({
        payload: raw,
        secret,
        timestamp: Math.floor(Date.now() / 1000) - 600,
      }),
    ]) {
      const response = await client
        .post('/api/v1/payments/webhooks/stripe')
        .header('stripe-signature', signature)
        .json(payload)
      response.assertStatus(400)
    }
    const afterInvalid = await db.from('purchase_webhooks').count('* as total').first()
    assert.equal(afterInvalid.total, before.total)
    const signature = transport.client.webhooks.generateTestHeaderString({ payload: raw, secret })
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client
        .post('/api/v1/payments/webhooks/stripe')
        .header('stripe-signature', signature)
        .json(payload)
      response.assertStatus(202)
    }
    const events = await db.from('purchase_webhooks').where('event_key', payload.id)
    assert.lengthOf(events, 1)
    const accessesAfter = await db.from('benefit_accesses').count('* as total').first()
    assert.equal(accessesAfter.total, accessesBefore.total)
  })

  test('configuration failure is 500, never transient 503 or an acknowledged event', async ({
    client,
    assert,
  }) => {
    const before = await db.from('purchase_webhooks').count('* as total').first()
    mock.method(PaymentProviderService.prototype, 'get', () => {
      throw new PaymentConfigurationException('Payment provider configuration is incomplete')
    })
    const response = await client
      .post('/api/v1/payments/webhooks/stripe')
      .header('stripe-signature', 'unverified')
      .json({ id: randomUUID() })
    response.assertStatus(500)
    const after = await db.from('purchase_webhooks').count('* as total').first()
    assert.equal(after.total, before.total)
  })
})

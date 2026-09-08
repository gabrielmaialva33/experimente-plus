import { test } from '@japa/runner'
import { randomBytes, randomUUID } from 'node:crypto'
import StripeAdapter from '#modules/purchases/adapters/stripe_adapter'
import { stripeTransport } from '#tests/helpers/stripe_transport'
import type { PaymentRequest } from '#modules/purchases/interfaces/payment_port'

function setup() {
  const f = stripeTransport()
  const port = new StripeAdapter(
    f.state.account,
    'test',
    randomBytes(32).toString('hex'),
    undefined,
    f.client
  )
  return { ...f, port }
}

test.group('Stripe authenticated boundary offline', () => {
  test('replays immutable create/refund/cancel keys and obtains the actual confirmation time', async ({
    assert,
  }) => {
    const f = setup()
    const request: PaymentRequest = {
      id: randomUUID(),
      amountCents: 12345,
      currency: 'BRL',
      method: 'card',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      input: {
        email: 'buyer@example.test',
        card_token: 'pm_' + randomBytes(12).toString('hex'),
        payment_method_id: 'card',
      },
    }
    const paid = await f.port.create(request)
    await f.port.create(request)
    assert.deepEqual(f.calls[0], f.calls[1])
    assert.equal(paid.paidAt, new Date(f.state.confirmedAt * 1000).toISOString())
    assert.notEqual(paid.paidAt, new Date(f.payment.created * 1000).toISOString())
    const key = randomUUID()
    await f.port.refund(paid.id, 345, key)
    await f.port.refund(paid.id, 345, key)
    assert.deepEqual(f.calls[2], f.calls[3])
    const observed1 = await f.port.get(paid.id)
    assert.equal(observed1.refundedCents, 345)
    await f.port.refund(paid.id, 12000, randomUUID())
    const observed2 = await f.port.get(paid.id)
    assert.equal(observed2.state, 'refunded')
    await f.port.cancel(paid.id, key)
    assert.equal(f.calls.at(-1)!.key, key)
  })
  test('does not grant from authorization, action required, processing or unsettled refunds', async ({
    assert,
  }) => {
    for (const status of [
      'requires_capture',
      'requires_action',
      'processing',
      'requires_payment_method',
    ] as const) {
      const f = setup()
      f.payment.status = status
      const observed3 = await f.port.get(f.payment.id)
      assert.equal(observed3.state, 'pending')
    }
    const f = setup()
    await f.port.refund(f.payment.id, 345, randomUUID())
    f.refunds[0].status = 'pending'
    const observed4 = await f.port.get(f.payment.id)
    assert.equal(observed4.refundedCents, 0)
    f.charge.disputed = true
    f.disputes.push({ status: 'under_review' } as never)
    const observed5 = await f.port.get(f.payment.id)
    assert.equal(observed5.state, 'disputed')
    f.disputes[0].status = 'won'
    const observed6 = await f.port.get(f.payment.id)
    assert.equal(observed6.state, 'paid')
  })
  test('rejects wrong account, environment, currency, capture and missing confirmation evidence', async ({
    assert,
  }) => {
    for (const mutate of [
      (f: ReturnType<typeof setup>) => {
        f.state.account = 'different'
      },
      (f: ReturnType<typeof setup>) => {
        f.payment.livemode = true
      },
      (f: ReturnType<typeof setup>) => {
        f.payment.currency = 'usd'
      },
      (f: ReturnType<typeof setup>) => {
        f.charge.captured = false
      },
      (f: ReturnType<typeof setup>) => {
        f.state.eventVisible = false
      },
    ]) {
      const f = setup()
      mutate(f)
      await assert.rejects(
        () => f.port.get(f.payment.id),
        'Stripe request or payment evidence could not be verified'
      )
    }
    const f = setup()
    f.state.eventVisible = false
    const known = new Date().toISOString()
    const observed7 = await f.port.get(f.payment.id, known)
    assert.equal(observed7.paidAt, known)
  })
  test('fails closed for webhook without endpoint secret/raw signature and ambiguous recovery', async ({
    assert,
  }) => {
    const f = setup()
    assert.throws(() => f.port.verifyWebhook({}, '{}', {}))
    assert.throws(() => f.port.verifyWebhook({}, {}, {}))
    assert.equal((await f.port.find(f.payment.metadata.purchase_id))!.id, f.payment.id)
    f.state.duplicate = true
    await assert.rejects(() => f.port.find(f.payment.metadata.purchase_id))
    f.state.found = false
    assert.isNull(await f.port.find(f.payment.metadata.purchase_id))
  })
  test('uses stable Pix expiry and exposes only existing QR instruction fields', async ({
    assert,
  }) => {
    const f = setup()
    f.payment.status = 'requires_action'
    f.payment.next_action = {
      type: 'pix_display_qr_code',
      pix_display_qr_code: { data: 'generated-test-instruction' },
    }
    const input: PaymentRequest = {
      id: randomUUID(),
      amountCents: 12345,
      currency: 'BRL',
      method: 'pix',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      input: { email: 'buyer@example.test', name: 'Test Buyer' },
    }
    const result = await f.port.create(input)
    await f.port.create(input)
    assert.deepEqual(f.calls[0], f.calls[1])
    assert.deepEqual(result.instructions, {
      pix_code: 'generated-test-instruction',
      pix_url: undefined,
    })
    assert.equal(result.state, 'pending')
    assert.notProperty(result, 'client_secret')
  })
})

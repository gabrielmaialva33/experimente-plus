import { test } from '@japa/runner'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import MercadoPagoAdapter from '#modules/purchases/adapters/mercado_pago_adapter'
import type { PaymentRequest } from '#modules/purchases/interfaces/payment_port'

function signed(secret: string, id: string, ts = String(Date.now())) {
  const requestId = randomUUID()
  const manifest = 'id:' + id + ';request-id:' + requestId + ';ts:' + ts + ';'
  return {
    'x-request-id': requestId,
    'x-signature':
      'ts=' + ts + ',v1=' + createHmac('sha256', secret).update(manifest).digest('hex'),
  }
}
function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345,
    external_reference: randomUUID(),
    collector_id: 54321,
    live_mode: false,
    currency_id: 'BRL',
    transaction_amount: 123.45,
    transaction_amount_refunded: 0,
    status: 'approved',
    status_detail: 'accredited',
    captured: true,
    date_approved: new Date().toISOString(),
    ...overrides,
  }
}
function adapter(
  result: Record<string, unknown>,
  calls: Array<{ url: string; init: RequestInit }> = []
) {
  const secret = randomBytes(32).toString('hex')
  const transport: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(result), { status: 200 })
  }
  return {
    port: new MercadoPagoAdapter(
      '54321',
      'test',
      randomBytes(32).toString('hex'),
      secret,
      transport
    ),
    secret,
  }
}

test.group('Mercado Pago boundary without network or real secrets', () => {
  test('authenticates the signed manifest and rejects missing, tampered and expired signatures', ({
    assert,
  }) => {
    const { port, secret } = adapter(payment())
    const id = '12345'
    const headers = signed(secret, id)
    const body = { type: 'payment', data: { id } }
    const verified = port.verifyWebhook(headers, body, { 'data.id': id })
    assert.equal(verified.resourceId, id)
    assert.deepEqual(port.verifyWebhook(headers, body, { 'data.id': id }), verified)
    assert.throws(() => port.verifyWebhook({}, body, { 'data.id': id }))
    assert.throws(() =>
      port.verifyWebhook(headers, { ...body, data: { id: '222' } }, { 'data.id': '222' })
    )
    assert.throws(() =>
      port.verifyWebhook(signed(secret, id, String(Date.now() - 360000)), body, { 'data.id': id })
    )
    assert.throws(() =>
      port.verifyWebhook(signed(randomBytes(32).toString('hex'), id), body, { 'data.id': id })
    )
  })
  test('checks amount, currency, account, environment and captures only accredited payment', async ({
    assert,
  }) => {
    const { port } = adapter(payment())
    const observed = await port.get('12345')
    assert.equal(observed.amountCents, 12345)
    assert.equal(observed.state, 'paid')
    assert.equal(observed.environment, 'test')
    for (const change of [
      { live_mode: true },
      { collector_id: 111 },
      { currency_id: 'USD' },
      { transaction_amount: 12.345 },
      { transaction_amount_refunded: 200 },
    ])
      await assert.rejects(() => adapter(payment(change)).port.get('12345'))
    for (const status of ['pending', 'authorized', 'in_process', 'unknown']) {
      const resolved1 = await adapter(payment({ status })).port.get('12345')
      assert.equal(resolved1.state, 'pending')
    }
    const resolved2 = await adapter(payment({ captured: false })).port.get('12345')
    assert.equal(resolved2.state, 'pending')
    const resolved3 = await adapter(payment({ status: 'rejected' })).port.get('12345')
    assert.equal(resolved3.state, 'failed')
    const resolved4 = await adapter(payment({ status: 'charged_back' })).port.get('12345')
    assert.equal(resolved4.state, 'disputed')
    const resolved5 = await adapter(
      payment({ status: 'refunded', transaction_amount_refunded: 123.45 })
    ).port.get('12345')
    assert.equal(resolved5.state, 'refunded')
  })
  test('keeps create payload and PSP key stable on retry and uses tokenized single-payment card', async ({
    assert,
  }) => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const { port } = adapter(payment(), calls)
    const request: PaymentRequest = {
      id: randomUUID(),
      amountCents: 12345,
      currency: 'BRL',
      method: 'pix',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      input: { email: 'buyer@example.test' },
    }
    await port.create(request)
    await port.create(request)
    assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments')
    assert.equal(calls[0].init.body, calls[1].init.body)
    assert.equal(new Headers(calls[0].init.headers).get('X-Idempotency-Key'), request.id)
    const body = JSON.parse(String(calls[0].init.body))
    assert.equal(body.transaction_amount, 123.45)
    assert.equal(body.date_of_expiration, request.expiresAt)
    await port.create({
      ...request,
      method: 'card',
      input: {
        ...request.input,
        card_token: randomBytes(20).toString('hex'),
        payment_method_id: 'visa',
      },
    })
    const card = JSON.parse(String(calls[2].init.body))
    assert.equal(card.installments, 1)
    assert.isTrue(card.capture)
    assert.notProperty(card, 'card_number')
  })
  test('uses original refund key and sanitizes provider failures without leaking response content', async ({
    assert,
  }) => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const { port } = adapter(payment(), calls)
    const key = randomUUID()
    await port.refund('12345', 123, key)
    assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/12345/refunds')
    assert.equal(new Headers(calls[0].init.headers).get('X-Idempotency-Key'), key)
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { amount: 1.23 })
    const noise = randomBytes(30).toString('hex')
    const broken = new MercadoPagoAdapter(
      '54321',
      'test',
      randomBytes(32).toString('hex'),
      randomBytes(32).toString('hex'),
      async () => new Response(noise, { status: 503 })
    )
    await assert.rejects(() => broken.get('12345'), 'Payment provider HTTP 503')
  })
  test('search recovers only a unique authenticated reference and fails closed for duplicates', async ({
    assert,
  }) => {
    const found = payment()
    const resolved6 = await adapter({ paging: { total: 1 }, results: [found] }).port.find(
      String(found.external_reference)
    )
    assert.equal(resolved6!.id, '12345')
    assert.isNull(await adapter({ paging: { total: 0 }, results: [] }).port.find(randomUUID()))
    await assert.rejects(() =>
      adapter({ paging: { total: 2 }, results: [found, found] }).port.find(randomUUID())
    )
  })
})

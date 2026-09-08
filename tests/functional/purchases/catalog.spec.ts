import { useFakePayments } from '#tests/helpers/fake_payments'
import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import env from '#start/env'
import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'

async function fixture() {
  const s = await createBenefitFlowScenario({ suffix: randomUUID().slice(0, 8) })
  await s.access.delete()
  s.edition.merge({
    sales_starts_at: DateTime.utc().minus({ hours: 1 }),
    sales_ends_at: DateTime.utc().plus({ hours: 1 }),
    usage_starts_at: DateTime.utc().plus({ days: 1 }),
  })
  await s.edition.save()
  return s
}

test.group('Public purchasable edition storefront', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => useFakePayments())

  test('anonymous pre-sale exposes only public edition, city, terms and server payment methods', async ({
    client,
    assert,
  }) => {
    const s = await fixture()
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    response.assertStatus(200)
    const [edition] = response.body().editions
    assert.lengthOf(response.body().editions, 1)
    assert.sameMembers(Object.keys(edition), [
      'id',
      'edition_id',
      'offer_id',
      'product_type',
      'establishment',
      'name',
      'description',
      'city',
      'status',
      'sales_starts_at',
      'sales_ends_at',
      'usage_starts_at',
      'usage_ends_at',
      'payment_methods',
      'amount_cents',
      'currency',
      'snapshot',
      'purchasable',
    ])
    assert.equal(edition.id, s.edition.id)
    assert.equal(edition.name, s.edition.name)
    assert.equal(edition.description, s.edition.description)
    assert.equal(edition.amount_cents, s.edition.price_cents)
    assert.equal(edition.currency, 'BRL')
    assert.equal(edition.status, 'published')
    assert.isTrue(edition.purchasable)
    assert.deepEqual(edition.city, {
      id: s.geography.city.id,
      name: s.geography.city.name,
      slug: s.geography.city.slug,
      state_code: s.geography.city.state_code,
      timezone: s.geography.city.timezone,
    })
    assert.deepEqual(edition.payment_methods, ['pix', 'card'])
    for (const field of ['sales_starts_at', 'sales_ends_at', 'usage_starts_at', 'usage_ends_at']) {
      assert.equal(edition[field], edition.snapshot[field])
    }
    assert.isAbove(Date.parse(edition.usage_starts_at), Date.now())
    assert.isBelow(Date.parse(edition.sales_starts_at), Date.now())
    assert.equal(edition.snapshot.offers[0].id, s.offer.id)
    assert.sameMembers(Object.keys(edition.snapshot), [
      'product_type',
      'offer_id',
      'amount_cents',
      'currency',
      'name',
      'description',
      'usage_starts_at',
      'usage_ends_at',
      'sales_starts_at',
      'sales_ends_at',
      'offers',
      'terms_version',
    ])
    assert.notInclude(JSON.stringify(response.body()), s.users.holder.email)
  })

  test('omits editions outside the sales window or without a sales window', async ({
    client,
    assert,
  }) => {
    const s = await fixture()
    for (const window of [
      {
        sales_starts_at: DateTime.utc().plus({ hours: 1 }),
        sales_ends_at: DateTime.utc().plus({ hours: 2 }),
      },
      {
        sales_starts_at: DateTime.utc().minus({ hours: 2 }),
        sales_ends_at: DateTime.utc().minus({ hours: 1 }),
      },
      { sales_starts_at: null, sales_ends_at: null },
    ]) {
      await s.edition.merge(window).save()
      const response = await client
        .get('/api/v1/catalog/benefit-editions')
        .header('host', s.tenant.slug + '.experimente.test')
      response.assertStatus(200)
      assert.deepEqual(response.body(), { editions: [], offers: [] })
    }
  })

  test('omits unpublished editions and editions without active public offers', async ({
    client,
    assert,
  }) => {
    const s = await fixture()
    for (const status of ['draft', 'paused'] as const) {
      await s.edition
        .merge({ status, published_at: status === 'draft' ? null : DateTime.utc() })
        .save()
      const response = await client
        .get('/api/v1/catalog/benefit-editions')
        .header('host', s.tenant.slug + '.experimente.test')
      response.assertStatus(200)
      assert.deepEqual(response.body(), { editions: [], offers: [] })
    }
    await s.edition.merge({ status: 'published', published_at: DateTime.utc() }).save()
    await s.offer.merge({ status: 'paused' }).save()
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    response.assertStatus(200)
    assert.deepEqual(response.body(), { editions: [], offers: [] })
  })

  test('no enabled methods or unavailable provider yields an anonymous empty storefront, preserving discovery', async ({
    client,
    assert,
  }) => {
    const s = await fixture()
    for (const config of [
      { methods: 'none' as const, provider: 'fake' as const },
      { methods: 'pix,card' as const, provider: 'disabled' as const },
    ]) {
      env.set('PAYMENT_METHODS', config.methods)
      env.set('PAYMENT_PROVIDER', config.provider)
      const response = await client
        .get('/api/v1/catalog/benefit-editions')
        .header('host', s.tenant.slug + '.experimente.test')
      response.assertStatus(200)
      assert.deepEqual(response.body(), { editions: [], offers: [] })
      const discovery = await client
        .get('/api/v1/catalog/cities')
        .header('host', s.tenant.slug + '.experimente.test')
      discovery.assertStatus(200)
    }
  })

  test('client purchases with advertised method; disabled methods are refused and replay retains original result', async ({
    client,
    assert,
  }) => {
    const s = await fixture()
    env.set('PAYMENT_METHODS', 'card')
    const cardCatalog = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    assert.deepEqual(cardCatalog.body().editions[0].payment_methods, ['card'])
    env.set('PAYMENT_METHODS', 'pix')
    const catalog = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    const edition = catalog.body().editions[0]
    assert.deepEqual(edition.payment_methods, ['pix'])
    const input = {
      edition_id: edition.id,
      amount_cents: edition.amount_cents,
      terms_version: edition.snapshot.terms_version,
      method: edition.payment_methods[0],
    }
    const key = randomUUID()
    const send = (body: object, idempotencyKey = key) =>
      client
        .post('/api/v1/me/purchases')
        .loginAs(s.users.holder)
        .header('x-tenant-id', String(s.tenant.id))
        .header('idempotency-key', idempotencyKey)
        .json(body)
    const rejected = await send({ ...input, method: 'card' }, randomUUID())
    rejected.assertStatus(400)
    assert.include(JSON.stringify(rejected.body()), 'Payment method is not available')
    env.set('PAYMENT_METHODS', 'none')
    const staleQuote = await send(input)
    staleQuote.assertStatus(400)
    env.set('PAYMENT_METHODS', 'pix')
    const accepted = await send(input)
    accepted.assertStatus(202)
    const afterPurchase = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    assert.deepEqual(afterPurchase.body(), catalog.body())
    env.set('PAYMENT_METHODS', 'none')
    const replay = await send(input)
    replay.assertStatus(202)
    assert.deepEqual(replay.body(), accepted.body())
  })

  test('hostname isolates editions even if visitor supplies another tenant', async ({
    client,
    assert,
  }) => {
    const first = await fixture()
    const second = await fixture()
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', first.tenant.slug + '.experimente.test')
      .header('x-tenant-id', String(second.tenant.id))
      .qs({ tenant_id: second.tenant.id })
    response.assertStatus(200)
    assert.deepEqual(
      response.body().editions.map((edition: { id: number }) => edition.id),
      [first.edition.id]
    )
  })
})

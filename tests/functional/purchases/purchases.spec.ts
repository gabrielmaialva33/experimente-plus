import { useFakePayments } from '#tests/helpers/fake_payments'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { createPurchaseFixture } from '#database/factories/scenarios/purchase_flow_factory'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseOperationsService from '#modules/purchases/services/purchase_operations_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'

const fixture = () => createPurchaseFixture()

test.group('Purchases EP-14', (group) => {
  group.each.setup(() => useFakePayments({ autoRefundUnused: true }))
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  test('creates one immutable intention and one confirmed access, replaying purchase and webhook', async ({
    assert,
  }) => {
    const f = await fixture()
    const key = randomUUID()
    const p = await f.service.create(f.s.tenant.id, f.s.users.holder, key, f.input)
    assert.deepEqual(await f.service.create(f.s.tenant.id, f.s.users.holder, key, f.input), p)
    await assert.rejects(() =>
      f.service.create(f.s.tenant.id, f.s.users.holder, key, {
        ...f.input,
        amount_cents: f.input.amount_cents + 1,
      })
    )
    await assert.rejects(() => f.create())
    const resolved2 = await f.repo.get(p.id)
    assert.isNull(resolved2!.access_id)
    const resolved3 = await f.processor.drain()
    assert.equal(resolved3.deferred, 0)
    const resolved4 = await f.repo.get(p.id)
    assert.isNull(resolved4!.access_id)
    const resource = 'fake_' + p.id
    const event = randomUUID()
    const body = { resource_id: resource, event_id: event }
    const headers = { 'x-fake-signature': f.fake.sign(resource, event) }
    const first = await f.processor.webhook('fake', headers, body, {})
    assert.deepEqual(await f.processor.webhook('fake', headers, body, {}), first)
    await f.fake.simulate(resource, { state: 'paid', paidAt: new Date().toISOString() })
    await f.processor.reconcile()
    const resolved5 = await f.processor.drain()
    assert.equal(resolved5.deferred, 0)
    const confirmed = (await f.repo.get(p.id))!
    assert.isNumber(confirmed.access_id)
    assert.equal(confirmed.status, 'paid')
    const access = await BenefitAccess.findOrFail(confirmed.access_id!)
    assert.equal(access.source, 'payment')
    assert.isNotEmpty(access.external_reference!)
    await f.notify(p.id)
    const resolved6 = await f.repo.get(p.id)
    assert.equal(resolved6!.access_id, confirmed.access_id)
    assert.lengthOf(await f.repo.events().where({ purchase_id: p.id, action: 'access_granted' }), 1)
  })
  test('cancellation before dispatch is durable, replayable and never creates a remote payment', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    const key = randomUUID()
    assert.deepEqual(await f.service.cancel(f.s.tenant.id, f.s.users.holder, p.id, key), {
      id: p.id,
    })
    assert.deepEqual(await f.service.cancel(f.s.tenant.id, f.s.users.holder, p.id, key), {
      id: p.id,
    })
    const result = await f.processor.drain()
    assert.equal(result.deferred, 0)
    const stored = await f.repo.get(p.id)
    assert.equal(stored!.status, 'cancelled')
    assert.isNull(stored!.access_id)
    assert.isNull(await f.fake.find(p.id))
  })
  test('rejects ineligible editions, forged quotes, unrelated owners and malformed or unsigned requests', async ({
    assert,
    client,
  }) => {
    const f = await fixture()
    await assert.rejects(() =>
      f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), {
        ...f.input,
        terms_version: '0'.repeat(64),
      })
    )
    for (const values of [
      { status: 'paused' as const },
      { price_cents: 0 },
      { sales_starts_at: null, sales_ends_at: null },
      {
        sales_starts_at: DateTime.utc().plus({ hours: 1 }),
        sales_ends_at: DateTime.utc().plus({ hours: 2 }),
      },
    ]) {
      const original = {
        status: f.s.edition.status,
        price_cents: f.s.edition.price_cents,
        sales_starts_at: f.s.edition.sales_starts_at,
        sales_ends_at: f.s.edition.sales_ends_at,
      }
      f.s.edition.merge(values)
      await f.s.edition.save()
      await assert.rejects(() => f.create())
      f.s.edition.merge(original)
      await f.s.edition.save()
    }
    const p = await f.create()
    await assert.rejects(() => f.service.get(f.s.tenant.id, f.s.users.outsider, p.id))
    await assert.rejects(() => f.service.operations(f.s.tenant.id, f.s.users.partner))
    const unsigned = await client
      .post('/api/v1/payments/webhooks/fake')
      .json({ resource_id: 'fake_' + p.id, event_id: randomUUID() })
    assert.equal(unsigned.status(), 401, JSON.stringify(unsigned.body()))
    const invalid = await client
      .get('/api/v1/me/purchases/not-a-uuid')
      .header('x-tenant-id', String(f.s.tenant.id))
      .loginAs(f.s.users.holder)
    invalid.assertStatus(422)
  })
  test('refund blocks wallet, presentation, preview and confirmation; denial restores same remaining quota', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.paid()
    const redemption = await app.container.make(BenefitRedemptionService)
    const access = await app.container.make(BenefitAccessService)
    const token = await redemption.present(
      f.s.tenant.id,
      p.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const receipt = await redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    const next = await redemption.present(
      f.s.tenant.id,
      p.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const r = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      randomUUID(),
      'Solicitação após uso'
    )
    const resolved7 = await f.repo.refund(r.id)
    assert.equal(resolved7!.status, 'review')
    const wallet = await access.wallet(f.s.tenant.id, f.s.users.holder)
    assert.isTrue(wallet.passes[0].access.financially_blocked)
    assert.equal(wallet.passes[0].access.availability, 'paused')
    await assert.rejects(() =>
      redemption.present(
        f.s.tenant.id,
        p.access_id!,
        f.s.offer.id,
        f.s.users.holder,
        'http://localhost'
      )
    )
    await assert.rejects(() => redemption.preview(f.s.tenant.id, next.token, f.s.users.partner))
    await assert.rejects(() => redemption.redeem(f.s.tenant.id, next.token, f.s.users.partner))
    const resolved8 = await redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    assert.equal(resolved8.receipt_code, receipt.receipt_code)
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, p.id, r.id, {
      approve: false,
      reason: 'Análise comercial concluída',
    })
    const resolved9 = await access.wallet(f.s.tenant.id, f.s.users.holder)
    assert.isFalse(resolved9.passes[0].access.financially_blocked)
    const resolved10 = await redemption.redeem(f.s.tenant.id, next.token, f.s.users.partner)
    assert.equal(resolved10.redemption_number, 2)
  })
  test('unused refund is idempotent and only revokes after remote confirmation', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.paid()
    const key = randomUUID()
    const r = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      key,
      'Sem interesse na edição'
    )
    assert.deepEqual(
      await f.service.refund(f.s.tenant.id, f.s.users.holder, p.id, key, 'Sem interesse na edição'),
      r
    )
    const resolved11 = await BenefitAccess.findOrFail(p.access_id!)
    assert.equal(resolved11.status, 'active')
    const resolved12 = await f.processor.drain()
    assert.equal(resolved12.deferred, 0)
    const resolved13 = await f.repo.refund(r.id)
    assert.equal(resolved13!.status, 'succeeded')
    const resolved14 = await BenefitAccess.findOrFail(p.access_id!)
    assert.equal(resolved14.status, 'revoked')
    await f.notify(p.id)
    const resolved15 = await f.fake.get('fake_' + p.id)
    assert.equal(resolved15.refundedCents, p.amount_cents)
    const resolved16 = await f.repo.get(p.id)
    assert.equal(resolved16!.access_id, p.access_id)
  })
  test('partial refund after use preserves access and consumed quota; later total preserves receipt', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.paid()
    const redemption = await app.container.make(BenefitRedemptionService)
    const token = await redemption.present(
      f.s.tenant.id,
      p.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const receipt = await redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    const first = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      randomUUID(),
      'Ajuste comercial parcial'
    )
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, p.id, first.id, {
      approve: true,
      amount_cents: 100,
      reason: 'Ajuste parcial aprovado',
    })
    const resolved17 = await f.processor.drain()
    assert.equal(resolved17.deferred, 0)
    const resolved18 = await BenefitAccess.findOrFail(p.access_id!)
    assert.equal(resolved18.status, 'active')
    const second = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      randomUUID(),
      'Devolução do restante'
    )
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, p.id, second.id, {
      approve: true,
      reason: 'Devolução total aprovada',
    })
    const resolved19 = await f.processor.drain()
    assert.equal(resolved19.deferred, 0)
    const resolved20 = await redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    assert.equal(resolved20.receipt_code, receipt.receipt_code)
    const resolved21 = await BenefitAccess.findOrFail(p.access_id!)
    assert.equal(resolved21.status, 'revoked')
    assert.lengthOf(await db.from('benefit_redemptions').where('access_id', p.access_id!), 1)
  })
  test('pending, refused, disputed and refunded observations never create premature access', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    await f.processor.drain()
    for (const state of ['pending', 'failed', 'disputed'] as const) {
      await f.fake.simulate('fake_' + p.id, { state })
      await f.notify(p.id)
      const resolved22 = await f.repo.get(p.id)
      assert.isNull(resolved22!.access_id)
    }
    await f.fake.simulate('fake_' + p.id, {
      state: 'refunded',
      refundedCents: f.input.amount_cents,
    })
    await f.notify(p.id)
    await f.fake.simulate('fake_' + p.id, {
      state: 'paid',
      paidAt: new Date().toISOString(),
      refundedCents: 0,
    })
    await f.notify(p.id)
    const resolved23 = await f.repo.get(p.id)
    assert.isNull(resolved23!.access_id)
    const resolved24 = await f.repo.get(p.id)
    assert.equal(resolved24!.status, 'refunded')
  })
  test('recovers a lost webhook and releases only a resolved dispute hold', async ({ assert }) => {
    const f = await fixture()
    const p = await f.paid()
    await f.fake.simulate('fake_' + p.id, { state: 'disputed' })
    await f.notify(p.id)
    const resolved25 = await f.service.get(f.s.tenant.id, f.s.users.holder, p.id)
    assert.isTrue(resolved25.financially_blocked)
    await f.fake.simulate('fake_' + p.id, { state: 'paid' })
    await f.notify(p.id)
    const resolved26 = await f.service.get(f.s.tenant.id, f.s.users.holder, p.id)
    assert.isFalse(resolved26.financially_blocked)
  })
  test('compensates an impossible grant when administrative access won the race', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    await f.processor.drain()
    const manual = await BenefitAccess.create({
      tenant_id: f.s.tenant.id,
      edition_id: f.s.edition.id,
      user_id: f.s.users.holder.id,
      source: 'manual',
      status: 'active',
      granted_at: DateTime.utc(),
    })
    await f.fake.simulate('fake_' + p.id, { state: 'paid', paidAt: new Date().toISOString() })
    const resolved27 = await f.notify(p.id)
    assert.equal(resolved27.deferred, 0)
    const resolved28 = await f.repo.get(p.id)
    assert.equal(resolved28!.status, 'refunded')
    const resolved29 = await f.repo.get(p.id)
    assert.isNull(resolved29!.access_id)
    const resolved30 = await BenefitAccess.findOrFail(manual.id)
    assert.equal(resolved30.status, 'active')
  })
  test('records settlement evidence idempotently and identifies monetary differences and orphan payments', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.paid()
    const ops = await app.container.make(PurchaseOperationsService)
    const input = {
      provider_id: 'fake_' + p.id,
      statement_reference: randomUUID(),
      line_reference: '1',
      currency: 'BRL',
      gross_cents: p.amount_cents,
      fee_cents: 100,
      net_cents: p.amount_cents - 90,
      refunded_cents: 0,
      settled_at: new Date().toISOString(),
    }
    const result = await ops.settlement(f.s.tenant.id, f.s.users.admin, input)
    assert.deepEqual(await ops.settlement(f.s.tenant.id, f.s.users.admin, input), result)
    await assert.rejects(() =>
      ops.settlement(f.s.tenant.id, f.s.users.admin, { ...input, net_cents: 0 })
    )
    await ops.settlement(f.s.tenant.id, f.s.users.admin, {
      ...input,
      line_reference: '2',
      provider_id: randomUUID(),
    })
    const report = await ops.reconciliation(f.s.tenant.id, f.s.users.admin)
    assert.isTrue(report.issues.some((i) => i.reasons.includes('net_mismatch')))
    assert.isTrue(report.issues.some((i) => i.reasons.includes('orphan_payment')))
  })

  test('honors pre-sale and approval time when confirmation arrives after the sales quote', async ({
    assert,
    cleanup,
  }) => {
    const f = await fixture()
    f.s.edition.merge({ usage_starts_at: DateTime.utc().plus({ days: 1 }) })
    await f.s.edition.save()
    const resolved31 = await f.service.catalog(f.s.tenant.slug + '.experimente.test')
    const quote = resolved31.editions[0]
    const p = await f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), {
      ...f.input,
      terms_version: quote.snapshot.terms_version,
    })
    await f.processor.drain()
    const approved = new Date().toISOString()
    await f.fake.simulate('fake_' + p.id, { state: 'paid', paidAt: approved })
    mock.timers.enable({ apis: ['Date'], now: Date.now() + 2 * 3600000 })
    cleanup(() => mock.timers.reset())
    const resolved32 = await f.notify(p.id)
    assert.equal(resolved32.deferred, 0)
    const paid = (await f.repo.get(p.id))!
    assert.isNumber(paid.access_id)
    const redemption = await app.container.make(BenefitRedemptionService)
    await assert.rejects(() =>
      redemption.present(
        f.s.tenant.id,
        paid.access_id!,
        f.s.offer.id,
        f.s.users.holder,
        'http://localhost'
      )
    )
  })
  test('late payment outside quote is compensated without creating access', async ({ assert }) => {
    const f = await fixture()
    const p = await f.create()
    await f.processor.drain()
    const stored = (await f.repo.get(p.id))!
    await f.fake.simulate('fake_' + p.id, {
      state: 'paid',
      paidAt: new Date(stored.expires_at.getTime() + 1000).toISOString(),
    })
    const resolved33 = await f.notify(p.id)
    assert.equal(resolved33.deferred, 0)
    const resolved34 = await f.repo.get(p.id)
    assert.isNull(resolved34!.access_id)
    const resolved35 = await f.repo.get(p.id)
    assert.equal(resolved35!.status, 'refunded')
  })
  test('lost create response recovers by reference after restart without another create', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    let calls = 0
    class TimeoutAfterCreate extends FakePaymentAdapter {
      async create(request: Parameters<FakePaymentAdapter['create']>[0]): Promise<never> {
        calls++
        await super.create(request)
        throw new Error('Simulated response loss')
      }
    }
    const processing = new PurchaseProcessingService(f.repo, {
      get: () => new TimeoutAfterCreate(),
    })
    const resolved36 = await processing.drain()
    assert.equal(resolved36.deferred, 1)
    await f.repo.commands().where('purchase_id', p.id).update({ available_at: new Date() })
    const resolved37 = await processing.drain()
    assert.equal(resolved37.deferred, 0)
    assert.equal(calls, 1)
    const resolved38 = await f.repo.get(p.id)
    assert.equal(resolved38!.provider_id, 'fake_' + p.id)
  })
  test('auditing failure rolls back grant; retry uses confirmed payment once', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    await f.processor.drain()
    await f.fake.simulate('fake_' + p.id, { state: 'paid', paidAt: new Date().toISOString() })
    const event = randomUUID()
    const resource = 'fake_' + p.id
    await f.processor.webhook(
      'fake',
      { 'x-fake-signature': f.fake.sign(resource, event) },
      { resource_id: resource, event_id: event },
      {}
    )
    await f.processor.reconcile()
    class BrokenAudit extends PurchaseRepository {
      async audit(...args: Parameters<PurchaseRepository['audit']>) {
        if (args[1] === 'access_granted') throw new Error('Audit unavailable')
        return super.audit(...args)
      }
    }
    const processing = new PurchaseProcessingService(new BrokenAudit(), { get: () => f.fake })
    const resolved39 = await processing.drain()
    assert.isAbove(resolved39.deferred, 0)
    const resolved40 = await f.repo.get(p.id)
    assert.isNull(resolved40!.access_id)
    assert.lengthOf(
      await BenefitAccess.query().where({
        edition_id: f.s.edition.id,
        user_id: f.s.users.holder.id,
      }),
      0
    )
    await f.repo
      .commands()
      .where('purchase_id', p.id)
      .where('status', 'pending')
      .update({ available_at: new Date() })
    const resolved41 = await f.processor.drain()
    assert.equal(resolved41.deferred, 0)
    const resolved42 = await f.repo.get(p.id)
    assert.isNumber(resolved42!.access_id)
  })
  test('mismatched provider evidence creates a review hold and never grants', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    class WrongAmount extends FakePaymentAdapter {
      async create(request: Parameters<FakePaymentAdapter['create']>[0]) {
        return {
          ...(await super.create(request)),
          state: 'paid' as const,
          amountCents: 1,
          paidAt: new Date().toISOString(),
        }
      }
    }
    const processing = new PurchaseProcessingService(f.repo, { get: () => new WrongAmount() })
    await processing.drain()
    const resolved43 = await f.repo.get(p.id)
    assert.isNull(resolved43!.access_id)
    const resolved44 = await f.repo.get(p.id)
    assert.equal(resolved44!.issue, 'provider_identity_or_amount_mismatch')
    const resolved45 = await f.repo.commands().where('purchase_id', p.id).first()
    assert.equal(resolved45.status, 'review')
  })
  test('refund timeout preserves the hold and retries do not over-refund', async ({ assert }) => {
    const f = await fixture()
    const p = await f.paid()
    const r = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      randomUUID(),
      'Restituição sem uso'
    )
    let calls = 0
    class RefundTimeout extends FakePaymentAdapter {
      async refund(...args: Parameters<FakePaymentAdapter['refund']>) {
        calls++
        await super.refund(...args)
        throw new Error('Simulated lost refund response')
      }
    }
    const processing = new PurchaseProcessingService(f.repo, { get: () => new RefundTimeout() })
    const resolved46 = await processing.drain()
    assert.equal(resolved46.deferred, 1)
    const resolved47 = await f.service.get(f.s.tenant.id, f.s.users.holder, p.id)
    assert.isTrue(resolved47.financially_blocked)
    await f.repo.commands().where('refund_id', r.id).update({ available_at: new Date() })
    const resolved48 = await processing.drain()
    assert.equal(resolved48.deferred, 0)
    assert.equal(calls, 1)
    const resolved49 = await f.repo.refund(r.id)
    assert.equal(resolved49!.status, 'succeeded')
  })
  test('price changes do not change pending purchase and purchased usage conditions cannot silently change', async ({
    assert,
  }) => {
    const f = await fixture()
    const p = await f.create()
    f.s.edition.price_cents += 100
    await f.s.edition.save()
    const resolved50 = await f.repo.get(p.id)
    assert.equal(resolved50!.amount_cents, f.input.amount_cents)
    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx
          .from('benefit_editions')
          .where('id', f.s.edition.id)
          .update({ usage_ends_at: DateTime.utc().plus({ days: 1 }).toSQL() })
      })
    )
    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx
          .from('benefit_offers')
          .where('id', f.s.offer.id)
          .update({ max_redemptions_per_access: 1 })
      })
    )
    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await trx.from('purchases').where('id', p.id).update({ amount_cents: 1 })
      })
    )
  })
  test('anonymous catalog and commercial pre-sale are independent of payment and private purchase routes reject visitors', async ({
    assert,
    client,
  }) => {
    const f = await fixture()
    const catalog = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', f.s.tenant.slug + '.experimente.test')
    assert.equal(catalog.status(), 200, JSON.stringify(catalog.body()))
    assert.isTrue(catalog.body().editions.some((e: { id: number }) => e.id === f.s.edition.id))
    const cities = await client
      .get('/api/v1/catalog/cities')
      .header('host', f.s.tenant.slug + '.experimente.test')
    cities.assertStatus(200)
    const privateRoute = await client.get('/api/v1/me/purchases')
    privateRoute.assertStatus(401)
    const purchase = await client
      .post('/api/v1/me/purchases')
      .header('x-tenant-id', String(f.s.tenant.id))
      .header('idempotency-key', randomUUID())
      .loginAs(f.s.users.holder)
      .json(f.input)
    purchase.assertStatus(202)
    purchase.assertHeader('cache-control', 'private, no-store')
    const detail = await client
      .get('/api/v1/me/purchases/' + purchase.body().id)
      .header('x-tenant-id', String(f.s.tenant.id))
      .loginAs(f.s.users.holder)
    detail.assertStatus(200)
    assert.notProperty(detail.body(), 'payment_input')
    assert.notProperty(detail.body(), 'key_hash')
  })
})

test.group('Purchases independent PostgreSQL mutexes', (group) => {
  group.each.setup(() => useFakePayments({ autoRefundUnused: true }))
  // Committed fixtures intentionally remain in the isolated test ledger: financial facts are immutable.
  for (const first of ['redemption', 'refund'] as const) {
    test('serializes the access mutex when ' + first + ' wins', async ({ assert }) => {
      assert.equal(db.connectionGlobalTransactions.size, 0)
      const f = await fixture()
      const p = await f.paid()
      const redemption = await app.container.make(BenefitRedemptionService)
      const token = await redemption.present(
        f.s.tenant.id,
        p.access_id!,
        f.s.offer.id,
        f.s.users.holder,
        'http://localhost'
      )
      const gate = await db.transaction()
      await gate.from('benefit_accesses').where('id', p.access_id!).forUpdate().first()
      const outcomes: Array<Promise<unknown>> = []
      const redeem = () => redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
      const refund = () =>
        f.service.refund(
          f.s.tenant.id,
          f.s.users.holder,
          p.id,
          randomUUID(),
          'Corrida de restituição'
        )
      async function waitForBlocked() {
        for (let i = 0; i < 100; i++) {
          const result = await db.rawQuery(
            "SELECT count(*) AS total FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%benefit_accesses%'"
          )
          if (Number(result.rows[0].total) > 0) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error('Expected a real PostgreSQL lock wait')
      }
      try {
        const initial = first === 'redemption' ? redeem() : refund()
        outcomes.push(initial)
        await waitForBlocked()
        outcomes.push(first === 'redemption' ? refund() : redeem())
      } finally {
        await gate.commit()
      }
      const results = await Promise.allSettled(outcomes)
      assert.equal(results[0].status, 'fulfilled')
      const r = await f.repo.refunds().where('purchase_id', p.id).first()
      assert.equal(r.status, first === 'redemption' ? 'review' : 'approved')
      const rows = await db.from('benefit_redemptions').where('access_id', p.access_id!)
      assert.lengthOf(rows, first === 'redemption' ? 1 : 0)
      if (first === 'refund') assert.equal(results[1].status, 'rejected')
      else assert.equal(results[1].status, 'fulfilled')
      if (first === 'refund') {
        // A provider call must be able to acquire this same mutex on another connection.
        class LockCheckingProvider extends FakePaymentAdapter {
          async refund(...args: Parameters<FakePaymentAdapter['refund']>) {
            await db.transaction(async (trx) => {
              await trx.rawQuery('SELECT id FROM benefit_accesses WHERE id=? FOR UPDATE NOWAIT', [
                p.access_id!,
              ])
            })
            return super.refund(...args)
          }
        }
        const worker = new PurchaseProcessingService(f.repo, {
          get: () => new LockCheckingProvider(),
        })
        const resolved51 = await worker.drain()
        assert.equal(resolved51.deferred, 0)
      }
    })
  }
  test('two devices with one key create one intention and two different keys cannot double charge', async ({
    assert,
  }) => {
    const f = await fixture()
    const key = randomUUID()
    const results = await Promise.all([
      f.service.create(f.s.tenant.id, f.s.users.holder, key, f.input),
      f.service.create(f.s.tenant.id, f.s.users.holder, key, f.input),
    ])
    assert.deepEqual(results[0], results[1])
    await assert.rejects(() => f.create())
    const resolved52 = await f.processor.drain()
    assert.equal(resolved52.deferred, 0)
    assert.lengthOf(await db.from('purchase_fake_payments').where('purchase_id', results[0].id), 1)
    await f.service.cancel(f.s.tenant.id, f.s.users.holder, results[0].id, randomUUID())
    await f.processor.drain()
  })
})

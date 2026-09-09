import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { useFakePayments } from '#tests/helpers/fake_payments'
import {
  createPurchaseFixture,
  createPurchaseRefundScenario,
} from '#database/factories/scenarios/purchase_flow_factory'
import {
  BenefitEditionFactory,
  BenefitOfferFactory,
  EstablishmentFactory,
  EstablishmentRevisionFactory,
} from '#database/factories/index'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import BenefitPresentationTokenService from '#modules/benefits/services/benefit_presentation_token_service'

async function secondOffer(f: Awaited<ReturnType<typeof createPurchaseFixture>>) {
  const establishment = await EstablishmentFactory.merge({
    tenant_id: f.s.tenant.id,
    organization_id: f.s.organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
  }).create()
  const revision = await EstablishmentRevisionFactory.apply('approved')
    .merge({
      tenant_id: f.s.tenant.id,
      establishment_id: establishment.id,
      city_id: f.s.geography.city.id,
      slug: 'second-' + randomUUID(),
      public_name: 'Segunda loja demonstrativa',
      created_by: f.s.users.admin.id,
      reviewed_by: f.s.users.admin.id,
    })
    .create()
  await establishment.merge({ published_revision_id: revision.id }).save()
  return BenefitOfferFactory.apply('active')
    .merge({
      tenant_id: f.s.tenant.id,
      edition_id: f.s.edition.id,
      establishment_id: establishment.id,
      standalone_price_cents: 2390,
    })
    .create()
}

async function walletFor(f: Awaited<ReturnType<typeof createPurchaseFixture>>) {
  const accesses = await app.container.make(BenefitAccessService)
  const redemptions = await app.container.make(BenefitRedemptionService)
  const wallet = await accesses.wallet(f.s.tenant.id, f.s.users.holder)
  return redemptions.decorateWallet(f.s.tenant.id, f.s.users.holder.id, wallet)
}

test.group('Standalone vouchers and edition packages', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('anonymous storefront offers two product kinds with distinct prices and authenticated purchase uses the advertised scope', async ({
    client,
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', f.s.tenant.slug + '.experimente.test')
    response.assertStatus(200)
    const { products, editions, offers } = response.body()
    assert.lengthOf(editions, 1)
    assert.lengthOf(offers, 1)
    assert.deepEqual(products, [...editions, ...offers])
    assert.sameMembers(
      products.map((product: { product_type: string }) => product.product_type),
      ['edition', 'offer']
    )
    const product = products.find(
      (candidate: { product_type: string }) => candidate.product_type === 'offer'
    )!
    assert.match(product.terms_version, /^[a-f0-9]{64}$/)
    assert.equal(product.terms_version, product.snapshot.terms_version)
    const input = {
      edition_id: product.edition_id,
      offer_id: product.offer_id,
      amount_cents: product.amount_cents,
      terms_version: product.terms_version,
      method: product.payment_methods[0],
    }
    assert.equal(offers[0].amount_cents, 1290)
    assert.notEqual(offers[0].amount_cents, editions[0].amount_cents)
    assert.equal(offers[0].product_type, 'offer')
    assert.equal(offers[0].offer_id, f.s.offer.id)
    assert.equal(offers[0].establishment.id, f.s.establishment.id)
    assert.equal(offers[0].snapshot.offers.length, 1)
    assert.deepEqual(offers[0].payment_methods, ['pix', 'card'])
    assert.notInclude(JSON.stringify(response.body()), f.s.users.holder.email)
    const key = randomUUID()
    const send = (body: object) =>
      client
        .post('/api/v1/me/purchases')
        .loginAs(f.s.users.holder)
        .header('x-tenant-id', String(f.s.tenant.id))
        .header('idempotency-key', key)
        .json(body)
    const created = await send(input)
    created.assertStatus(202)
    const replay = await send(input)
    replay.assertStatus(202)
    assert.deepEqual(replay.body(), created.body())
    const conflict = await send({ ...input, offer_id: null })
    conflict.assertStatus(409)
    const pending = await f.repo.get(created.body().id)
    assert.isNull(pending!.access_id)
    await f.processor.drain()
    await f.fake.simulate('fake_' + pending!.id, {
      state: 'paid',
      paidAt: new Date().toISOString(),
    })
    await f.notify(pending!.id)
    const paid = await f.repo.get(pending!.id)
    const access = await BenefitAccess.findOrFail(paid!.access_id!)
    assert.equal(access.offer_id, f.s.offer.id)
    await f.notify(pending!.id)
    assert.lengthOf(
      await f.repo.events().where({ purchase_id: pending!.id, action: 'access_granted' }),
      1
    )
  })

  test('public standalone terms match the validator and cannot be replaced by package or malformed terms', async ({
    client,
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', f.s.tenant.slug + '.experimente.test')
    response.assertStatus(200)
    const { products } = response.body()
    const product = products.find((p: { product_type: string }) => p.product_type === 'offer')!
    const edition = products.find((p: { product_type: string }) => p.product_type === 'edition')!
    assert.notEqual(product.terms_version, edition.terms_version)
    const input = {
      edition_id: product.edition_id,
      offer_id: product.offer_id,
      amount_cents: product.amount_cents,
      method: product.payment_methods[0],
    }
    const send = (terms: object) =>
      client
        .post('/api/v1/me/purchases')
        .loginAs(f.s.users.holder)
        .header('x-tenant-id', String(f.s.tenant.id))
        .header('idempotency-key', randomUUID())
        .json({ ...input, ...terms })
    for (const terms of [{}, { terms_version: 'v1' }, { terms_version: 'A'.repeat(64) }]) {
      const invalid = await send(terms)
      invalid.assertStatus(422)
    }
    const stale = await send({ terms_version: edition.terms_version })
    stale.assertStatus(400)
    assert.include(JSON.stringify(stale.body()), 'Quote changed')
    const accepted = await send({ terms_version: product.terms_version })
    accepted.assertStatus(202)
  })

  test('wallet preserves independent scopes and every presentation path rejects an unpurchased offer', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer', maxRedemptionsPerAccess: 1 })
    const other = await secondOffer(f)
    const paid = await f.paid()
    const grants = await app.container.make(BenefitAccessService)
    const packageAccess = await grants.grant(f.s.tenant.id, f.s.users.admin, {
      edition_id: f.s.edition.id,
      email: f.s.users.holder.email,
      source: 'courtesy',
    })
    const redemption = await app.container.make(BenefitRedemptionService)
    const wallet = await walletFor(f)
    assert.lengthOf(wallet.passes, 2)
    const single = wallet.passes.find((pass) => pass.access.id === paid.access_id)!
    const bundle = wallet.passes.find((pass) => pass.access.id === packageAccess.id)!
    assert.deepEqual(
      single.benefits.map((b) => b.offer_id),
      [f.s.offer.id]
    )
    assert.sameMembers(
      bundle.benefits.map((b) => b.offer_id),
      [f.s.offer.id, other.id]
    )
    await assert.rejects(
      () =>
        redemption.present(
          f.s.tenant.id,
          paid.access_id!,
          other.id,
          f.s.users.holder,
          'http://localhost'
        ),
      /Benefit not found/
    )
    const forged = new BenefitPresentationTokenService().issue({
      tenantId: f.s.tenant.id,
      accessId: paid.access_id!,
      offerId: other.id,
      userId: f.s.users.holder.id,
    })
    await assert.rejects(
      () => redemption.preview(f.s.tenant.id, forged.token, f.s.users.partner),
      /Benefit not found/
    )
    await assert.rejects(
      () => redemption.redeem(f.s.tenant.id, forged.token, f.s.users.partner),
      /Benefit not found/
    )
    const valid = await redemption.present(
      f.s.tenant.id,
      paid.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const receipt = await redemption.redeem(f.s.tenant.id, valid.token, f.s.users.partner)
    assert.deepEqual(
      await redemption.redeem(f.s.tenant.id, valid.token, f.s.users.partner),
      receipt
    )
    await assert.rejects(
      () =>
        redemption.present(
          f.s.tenant.id,
          paid.access_id!,
          f.s.offer.id,
          f.s.users.holder,
          'http://localhost'
        ),
      /limit/
    )
    const independent = await redemption.present(
      f.s.tenant.id,
      packageAccess.id,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    await redemption.redeem(f.s.tenant.id, independent.token, f.s.users.partner)
    const after = await walletFor(f)
    assert.equal(after.summary.redeemed, 2)
  })

  test('standalone wallet keeps its identity when paused or archived and projects its effective usage window', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const starts = DateTime.utc().plus({ days: 1 })
    const ends = DateTime.utc().plus({ days: 2 })
    await f.s.offer.merge({ starts_at: starts, ends_at: ends }).save()
    const catalog = await f.service.catalog(f.s.tenant.slug + '.experimente.test')
    const quote = catalog.offers[0]
    f.input.terms_version = quote.snapshot.terms_version
    const paid = await f.paid()
    const passWallet = await walletFor(f)
    const pass = passWallet.passes.find((p) => p.access.id === paid.access_id)!
    assert.equal(DateTime.fromISO(pass.access.usage_starts_at!).toMillis(), starts.toMillis())
    assert.equal(DateTime.fromISO(pass.access.usage_ends_at!).toMillis(), ends.toMillis())
    assert.equal(pass.benefits[0].availability, 'upcoming')
    await f.s.offer.merge({ status: 'paused' }).save()
    const pausedWallet = await walletFor(f)
    const paused = pausedWallet.passes.find((p) => p.access.id === paid.access_id)!
    assert.equal(paused.benefits[0].title, f.s.offer.title)
    assert.equal(paused.access.availability, 'paused')
    await f.s.offer.merge({ status: 'archived', archived_at: DateTime.utc() }).save()
    const archivedWallet = await walletFor(f)
    const archived = archivedWallet.passes.find((p) => p.access.id === paid.access_id)!
    assert.equal(archived.benefits[0].title, f.s.offer.title)
    assert.equal(archived.access.availability, 'expired')
  })

  test('scope FKs, access immutability and redemption scope reject direct SQL escalation', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const other = await secondOffer(f)
    const paid = await f.paid()
    const grants = await app.container.make(BenefitAccessService)
    await assert.rejects(
      () =>
        grants.grant(f.s.tenant.id, f.s.users.admin, {
          edition_id: f.s.edition.id,
          offer_id: f.s.offer.id,
          email: f.s.users.holder.email,
        }),
      /already has active access/
    )
    await assert.rejects(
      () =>
        db.transaction(async (trx) => {
          await trx.from('benefit_accesses').where('id', paid.access_id!).update({ offer_id: null })
        }),
      /scope is immutable/
    )
    const unrelated = await BenefitEditionFactory.apply('published')
      .merge({
        tenant_id: f.s.tenant.id,
        city_id: f.s.geography.city.id,
      })
      .create()
    await assert.rejects(
      () =>
        db.transaction(async (trx) => {
          await trx.table('benefit_accesses').insert({
            tenant_id: f.s.tenant.id,
            edition_id: unrelated.id,
            offer_id: f.s.offer.id,
            user_id: f.s.users.holder.id,
            source: 'courtesy',
            status: 'active',
          })
        }),
      /foreign key/
    )
    const redemption = await app.container.make(BenefitRedemptionService)
    const token = await redemption.present(
      f.s.tenant.id,
      paid.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    await redemption.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    const original = await db
      .from('benefit_redemptions')
      .where('access_id', paid.access_id!)
      .firstOrFail()
    await assert.rejects(
      () =>
        db.transaction(async (trx) => {
          await trx
            .from('benefit_redemptions')
            .where('id', original.id)
            .update({ offer_id: other.id, establishment_id: other.establishment_id })
        }),
      /outside the access scope/
    )
  })

  test('single offer is purchasable in a zero-price edition, but rejects unpriced, inactive, expired and cross-edition offers', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    await f.s.edition.merge({ price_cents: 0 }).save()
    let catalog = await f.service.catalog(f.s.tenant.slug + '.experimente.test')
    assert.lengthOf(catalog.editions, 0)
    assert.lengthOf(catalog.offers, 1)
    for (const attributes of [
      { standalone_price_cents: null, status: 'active' as const },
      { standalone_price_cents: 1290, status: 'paused' as const },
    ]) {
      await f.s.offer.merge(attributes).save()
      catalog = await f.service.catalog(f.s.tenant.slug + '.experimente.test')
      assert.lengthOf(catalog.offers, 0)
      await assert.rejects(() => f.create(), /not available/)
    }
    await f.s.offer
      .merge({
        status: 'active',
        standalone_price_cents: 1290,
        starts_at: DateTime.utc().minus({ days: 2 }),
        ends_at: DateTime.utc().minus({ days: 1 }),
      })
      .save()
    catalog = await f.service.catalog(f.s.tenant.slug + '.experimente.test')
    assert.lengthOf(catalog.offers, 0)
    const other = await createPurchaseFixture({ product: 'offer' })
    await assert.rejects(
      () =>
        f.service.create(f.s.tenant.id, f.s.users.holder, randomUUID(), {
          ...f.input,
          offer_id: other.s.offer.id,
        }),
      /not available/
    )
  })

  test('confirmed avulso is compensated if its offer is archived before grant', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const p = await f.create()
    await f.processor.drain()
    await f.s.offer.merge({ status: 'archived', archived_at: DateTime.utc() }).save()
    await f.fake.simulate('fake_' + p.id, { state: 'paid', paidAt: new Date().toISOString() })
    await f.notify(p.id)
    const result = await f.repo.get(p.id)
    assert.isNull(result!.access_id)
    const refunds = await f.repo.refunds().where('purchase_id', p.id)
    assert.lengthOf(refunds, 1)
    assert.equal(refunds[0].amount_cents, 1290)
  })

  test('standalone price is frozen and full refund blocks only its own scope', async ({
    assert,
  }) => {
    const f = await createPurchaseFixture({ product: 'offer' })
    const p = await f.paid()
    const grants = await app.container.make(BenefitAccessService)
    const packageAccess = await grants.grant(f.s.tenant.id, f.s.users.admin, {
      edition_id: f.s.edition.id,
      email: f.s.users.holder.email,
      source: 'courtesy',
    })
    await f.s.offer.merge({ standalone_price_cents: 1990 }).save()
    const key = randomUUID()
    const request = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      p.id,
      key,
      'Restituição do voucher avulso'
    )
    assert.deepEqual(
      await f.service.refund(
        f.s.tenant.id,
        f.s.users.holder,
        p.id,
        key,
        'Restituição do voucher avulso'
      ),
      request
    )
    const r = await f.repo.refund(request.id)
    assert.equal(r!.amount_cents, 1290)
    const wallet = await grants.wallet(f.s.tenant.id, f.s.users.holder)
    assert.isTrue(
      wallet.passes.find((pass) => pass.access.id === p.access_id)!.access.financially_blocked
    )
    assert.isFalse(
      wallet.passes.find((pass) => pass.access.id === packageAccess.id)!.access.financially_blocked
    )
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, p.id, request.id, {
      approve: true,
      reason: 'Aprovada restituição avulsa',
    })
    await f.processor.drain()
    const single = await BenefitAccess.findOrFail(p.access_id!)
    await packageAccess.refresh()
    assert.equal(single.status, 'revoked')
    assert.equal(packageAccess.status, 'active')
    assert.lengthOf(await f.repo.purchases().where('id', p.id), 1)
  })

  test('partial standalone refund after use keeps the original consumed quota and receipt', async ({
    assert,
  }) => {
    const f = await createPurchaseRefundScenario({ product: 'offer', kind: 'partial' })
    assert.equal(f.purchase.amount_cents, 1290)
    assert.equal(f.refund.amount_cents, 645)
    assert.equal(f.access.offer_id, f.s.offer.id)
    assert.equal(f.access.status, 'active')
    const redemption = await app.container.make(BenefitRedemptionService)
    const wallet = await walletFor(f)
    assert.equal(wallet.passes[0].benefits[0].redemption_count, 1)
    assert.equal(wallet.passes[0].benefits[0].remaining_redemptions, 1)
  })
})

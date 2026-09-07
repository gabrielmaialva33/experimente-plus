import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { Settings } from 'luxon'
import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { seedDevelopmentPurchases } from '#database/support/development_purchases'
import DevelopmentSeeder from '#database/seeders/development_seeder'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import PurchaseService from '#modules/purchases/services/purchase_service'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'

test.group('Development paid edition seed', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('remains restricted to the development environment', async ({ assert }) => {
    assert.deepEqual(DevelopmentSeeder.environment, ['development'])
  })

  test('adds a buyable edition without courtesy and reruns preserve terms after confirmed payment', async ({
    assert,
    client,
  }) => {
    const s = await createBenefitFlowScenario({ suffix: randomUUID().slice(0, 8) })
    await s.geography.city.merge({ slug: 'londrina' }).save()
    await s.revision.merge({ slug: 'bar-estacao-43-londrina' }).save()
    const seed = () => seedDevelopmentPurchases(s.tenant, s.users.admin, s.users.partner)
    const edition = await seed()
    const again = await seed()
    assert.equal(again.id, edition.id)
    assert.equal(edition.price_cents, 4990)
    assert.equal(edition.currency, 'BRL')
    assert.lengthOf(await BenefitEdition.query().where('tenant_id', s.tenant.id), 2)
    assert.lengthOf(await BenefitOffer.query().where('edition_id', edition.id), 1)
    assert.lengthOf(await BenefitAccess.query().where('edition_id', edition.id), 0)
    await s.access.refresh()
    assert.equal(s.access.source, 'courtesy')
    assert.equal(s.access.status, 'active')

    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', s.tenant.slug + '.experimente.test')
    response.assertStatus(200)
    const quote = response.body().editions.find((item: { id: number }) => item.id === edition.id)
    assert.deepEqual(quote.payment_methods, ['pix', 'card'])
    const service = await app.container.make(PurchaseService)
    const processor = await app.container.make(PurchaseProcessingService)
    const repository = new PurchaseRepository()
    const fake = new FakePaymentAdapter()
    const purchase = await service.create(s.tenant.id, s.users.holder, randomUUID(), {
      edition_id: edition.id,
      amount_cents: quote.amount_cents,
      terms_version: quote.snapshot.terms_version,
      method: quote.payment_methods[0],
      email: s.users.holder.email,
    })
    await processor.drain()
    await fake.simulate('fake_' + purchase.id, { state: 'paid', paidAt: new Date().toISOString() })
    await processor.reconcile()
    await processor.drain()
    const paid = (await repository.get(purchase.id))!
    assert.equal(paid.status, 'paid')
    const access = await BenefitAccess.findOrFail(paid.access_id!)
    assert.equal(access.source, 'payment')

    const originalNow = Settings.now
    try {
      Settings.now = () => Date.now() + 86_400_000
      const rerun = await seed()
      assert.equal(rerun.id, edition.id)
      assert.equal(rerun.usage_ends_at.toMillis(), edition.usage_ends_at.toMillis())
      assert.equal(rerun.sales_ends_at!.toMillis(), edition.sales_ends_at!.toMillis())
    } finally {
      Settings.now = originalNow
    }
    const after = await service.catalog(s.tenant.slug + '.experimente.test')
    assert.deepEqual(
      after.editions.find((item) => item.id === edition.id),
      quote
    )
    assert.lengthOf(await BenefitAccess.query().where('edition_id', edition.id), 1)
    assert.lengthOf(await BenefitOffer.query().where('edition_id', edition.id), 1)
  })
})

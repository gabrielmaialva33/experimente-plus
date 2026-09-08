import { createHash, randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import DevelopmentSeeder from '#database/seeders/development_seeder'
import { developmentIllustration } from '#database/support/development_media'
import Tenant from '#modules/tenants/models/tenant'
import MediaAsset from '#modules/media/models/media_asset'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import StoredFile from '#modules/files/models/file'
import PurchaseService from '#modules/purchases/services/purchase_service'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import User from '#modules/users/models/user'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import { useFakePayments } from '#tests/helpers/fake_payments'

test.group('Development illustrations and immutable public composition', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  test('full seed is idempotent with valid originals, complete published composition and both products', async ({
    assert,
    client,
    cleanup,
  }) => {
    await DevelopmentSeeder.prototype.run()
    const tenant = await Tenant.findByOrFail('slug', 'development')
    cleanup(async () =>
      rm(app.makePath('storage', 'seed/media/v2/fs', String(tenant.id)), {
        recursive: true,
        force: true,
      })
    )
    const assets = await MediaAsset.query().where('tenant_id', tenant.id).preload('file')
    assert.lengthOf(assets, 3)
    const identities = assets.map((a) => a.id)
    for (const asset of assets) {
      assert.equal(asset.width, 1200)
      assert.equal(asset.height, 800)
      const buffer = await readFile(join(app.makePath('storage'), asset.file.file_name))
      assert.equal(buffer.readUInt32BE(16), 1200)
      assert.equal(buffer.readUInt32BE(20), 800)
      assert.isAbove(buffer.length, 10000)
      assert.equal(createHash('sha256').update(buffer).digest('hex'), asset.checksum_sha256)
      assert.equal(asset.file.file_size, buffer.length)
      assert.include(asset.file.url, '/uploads/seed/media/v2/fs/')
      const response = await client.get(asset.file.url)
      response.assertStatus(200)
      response.assertHeader('content-type', 'image/png')
    }
    const before = await EstablishmentRevision.query().where('tenant_id', tenant.id)
    await DevelopmentSeeder.prototype.run()
    const after = await EstablishmentRevision.query().where('tenant_id', tenant.id)
    assert.deepEqual(
      after.map((r) => r.id),
      before.map((r) => r.id)
    )
    const repeatedAssets = await MediaAsset.query().where('tenant_id', tenant.id)
    assert.deepEqual(
      repeatedAssets.map((a) => a.id),
      identities
    )
    const establishments = await Establishment.query().where('tenant_id', tenant.id)
    for (const venue of establishments) {
      const media = await EstablishmentRevisionMedia.query().where(
        'revision_id',
        venue.published_revision_id!
      )
      assert.lengthOf(media, 1)
      assert.equal(media[0].moderation_status, 'approved')
      assert.isTrue(media[0].is_cover)
      assert.include(media[0].alt_text!, 'Ilustração demonstrativa original')
    }
    const service = await app.container.make(PurchaseService)
    const catalog = await service.catalog('development.experimente.test')
    assert.lengthOf(catalog.editions, 1)
    assert.lengthOf(catalog.offers, 1)
    assert.equal(catalog.editions[0].amount_cents, 4990)
    assert.equal(catalog.offers[0].amount_cents, 1490)
    assert.deepEqual(catalog.offers[0].payment_methods, ['pix', 'card'])
    const courtesy = await BenefitAccess.query()
      .where({ tenant_id: tenant.id, source: 'courtesy' })
      .firstOrFail()
    const holder = await User.findOrFail(courtesy.user_id)
    const quote = catalog.offers[0]
    const purchase = await service.create(tenant.id, holder, randomUUID(), {
      email: holder.email,
      edition_id: quote.edition_id,
      offer_id: quote.offer_id,
      amount_cents: quote.amount_cents,
      terms_version: quote.snapshot.terms_version,
      method: quote.payment_methods[0],
    })
    const processor = await app.container.make(PurchaseProcessingService)
    await processor.drain()
    await new FakePaymentAdapter().simulate('fake_' + purchase.id, {
      state: 'paid',
      paidAt: new Date().toISOString(),
    })
    await processor.reconcile()
    await processor.drain()
    const paid = (await new PurchaseRepository().get(purchase.id))!
    assert.equal(paid.status, 'paid')
    const paidAccess = await BenefitAccess.findOrFail(paid.access_id!)
    assert.equal(paidAccess.offer_id, quote.offer_id)
    await DevelopmentSeeder.prototype.run()
    assert.deepEqual(await service.catalog('development.experimente.test'), catalog)
  })

  test('configured storage URL is authoritative and replacing old media creates a new revision without mutating the old composition', async ({
    assert,
  }) => {
    const objects = new Map<string, Buffer>()
    mock.method(drive, 'use', () => ({
      async put(key: string, bytes: Buffer, options: { contentType: string }) {
        assert.equal(options.contentType, 'image/png')
        objects.set(key, bytes)
      },
      async getUrl(key: string) {
        return 'https://media.example.test/' + key
      },
    }))
    await DevelopmentSeeder.prototype.run()
    const tenant = await Tenant.findByOrFail('slug', 'development')
    const asset = await MediaAsset.query()
      .where('tenant_id', tenant.id)
      .preload('file')
      .firstOrFail()
    assert.equal(asset.file.url, 'https://media.example.test/' + asset.file.file_name)
    assert.isTrue(objects.has(asset.file.file_name))
    const venue = await Establishment.findOrFail(asset.establishment_id)
    const originalRevision = venue.published_revision_id!
    const oldComposition = await EstablishmentRevisionMedia.query()
      .where('revision_id', originalRevision)
      .firstOrFail()
    // Emulate the pre-v2 tiny seed object; the replacement must not edit its asset or composition.
    await asset.file.merge({ file_name: 'seed/media/legacy/' + asset.file.id + '.png' }).save()
    await asset.merge({ checksum_sha256: '0'.repeat(64), width: 8, height: 6 }).save()
    await DevelopmentSeeder.prototype.run()
    await venue.refresh()
    assert.notEqual(venue.published_revision_id, originalRevision)
    await oldComposition.refresh()
    await asset.refresh()
    assert.equal(oldComposition.media_asset_id, asset.id)
    assert.equal(asset.width, 8)
    const current = await EstablishmentRevisionMedia.query()
      .where('revision_id', venue.published_revision_id!)
      .preload('asset')
      .firstOrFail()
    assert.equal(current.asset.width, 1200)
    assert.notEqual(current.asset.id, asset.id)
    assert.equal(current.moderation_status, 'approved')
    assert.lengthOf(await StoredFile.query().where('tenant_id', tenant.id), 4)
    assert.isTrue(developmentIllustration('coffee').equals(developmentIllustration('coffee')))
    assert.isFalse(developmentIllustration('coffee').equals(developmentIllustration('petiscos')))
  })
})

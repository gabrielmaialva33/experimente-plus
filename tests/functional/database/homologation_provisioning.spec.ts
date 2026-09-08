import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFile, rm, mkdtemp, writeFile, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import HomologationProvisioningService from '#modules/tenants/services/homologation_provisioning_service'
import {
  parseProvisioningConfig,
  readProvisioningConfig,
  ACCOUNT_KINDS,
  type HomologationProvisioningConfig,
} from '#modules/tenants/services/homologation_provisioning_config'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import MediaAsset from '#modules/media/models/media_asset'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import PurchaseService from '#modules/purchases/services/purchase_service'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import { useFakePayments } from '#tests/helpers/fake_payments'

function configuration(): HomologationProvisioningConfig {
  const accounts = {} as HomologationProvisioningConfig['accounts']
  for (const kind of ACCOUNT_KINDS)
    accounts[kind] = {
      fullName: 'Provisioning ' + kind,
      email: randomUUID() + '@example.test',
      password: randomBytes(32).toString('base64url') + 'aB7',
    }
  return {
    tenantSlug: 'provision-' + randomUUID().slice(0, 8),
    tenantName: 'Homologação demonstrativa',
    accounts,
  }
}

test.group('Homologation provisioning', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  function deployment(value: string | undefined) {
    const original = env.get.bind(env)
    mock.method(env, 'get', (key: string, fallback?: string) =>
      key === 'DEPLOYMENT_ENV' ? value : (original(key) ?? fallback)
    )
  }

  test('refuses missing, invalid, production and development policy before touching storage or database', async ({
    assert,
  }) => {
    for (const value of [undefined, 'invalid', 'production', 'development']) {
      deployment(value)
      await assert.rejects(
        () => new HomologationProvisioningService().run(configuration()),
        /DEPLOYMENT_ENV/
      )
      mock.restoreAll()
    }
  })

  test('private input rejects symlinks, broad permissions, weak passwords and local seed identities without echoing input', async ({
    assert,
    cleanup,
  }) => {
    const dir = await mkdtemp(join(tmpdir(), 'provision-config-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const path = join(dir, 'private.json')
    const input = configuration()
    await writeFile(path, JSON.stringify(input), { mode: 0o600 })
    const loaded = await readProvisioningConfig(path, app.makePath())
    assert.equal(loaded.tenantSlug, input.tenantSlug)
    await chmod(path, 0o644)
    await assert.rejects(() => readProvisioningConfig(path, app.makePath()), /0600/)
    await chmod(path, 0o600)
    await symlink(path, join(dir, 'link.json'))
    await assert.rejects(
      () => readProvisioningConfig(join(dir, 'link.json'), app.makePath()),
      /non-symlink/
    )
    input.accounts.customer.email = 'forbidden@experimente.local'
    assert.throws(() => parseProvisioningConfig(input), 'Invalid provisioning configuration')
    input.accounts.customer.email = randomUUID() + '@example.test'
    input.accounts.customer.password = randomBytes(4).toString('hex')
    assert.throws(() => parseProvisioningConfig(input), 'Invalid provisioning configuration')
  })

  test('provisions complete public media, package and single-offer purchases; replay preserves credentials, moderation, revocation and paid terms', async ({
    assert,
    client,
    cleanup,
  }) => {
    deployment('homologation')
    const input = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', input.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const service = new HomologationProvisioningService()
    const receipt = await service.run(input)
    assert.isTrue(receipt.created)
    const user = await User.findOrFail(receipt.accounts.customer)
    assert.isTrue(await hash.use('argon').verify(user.password, input.accounts.customer.password))
    const administrator = await User.findOrFail(receipt.accounts.administrator)
    await administrator.load('roles')
    assert.deepEqual(
      administrator.roles.map((r) => r.slug),
      ['admin']
    )
    const partner = await User.findOrFail(receipt.accounts.partner)
    await partner.load('roles')
    assert.deepEqual(
      partner.roles.map((r) => r.slug),
      ['user']
    )
    const assets = await MediaAsset.query().where('tenant_id', receipt.tenantId).preload('file')
    assert.lengthOf(assets, 2)
    for (const asset of assets) {
      const bytes = await readFile(app.makePath('storage', asset.file.file_name))
      assert.equal(bytes.readUInt32BE(16), 1200)
      assert.equal(bytes.readUInt32BE(20), 800)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.checksum_sha256)
      const image = await client.get(asset.file.url)
      image.assertStatus(200)
      image.assertHeader('content-type', 'image/png')
    }
    const catalog = await client
      .get('/api/v1/catalog/cities/londrina/establishments')
      .header('host', input.tenantSlug + '.experimente.test')
    catalog.assertStatus(200)
    const purchases = await app.container.make(PurchaseService)
    const quote = await purchases.catalog(input.tenantSlug + '.experimente.test')
    assert.lengthOf(quote.editions, 1)
    assert.lengthOf(quote.offers, 2)
    const response = await client
      .get('/api/v1/catalog/benefit-editions')
      .header('host', input.tenantSlug + '.experimente.test')
    response.assertStatus(200)
    const processor = await app.container.make(PurchaseProcessingService)
    for (const product of [quote.editions[0], quote.offers[0]]) {
      const purchase = await purchases.create(receipt.tenantId, user, randomUUID(), {
        edition_id: product.edition_id,
        offer_id: product.snapshot.offer_id ?? undefined,
        amount_cents: product.amount_cents,
        terms_version: product.snapshot.terms_version,
        method: product.payment_methods[0],
        email: user.email,
      })
      await processor.drain()
      await new FakePaymentAdapter().simulate('fake_' + purchase.id, {
        state: 'paid',
        paidAt: new Date().toISOString(),
      })
      await processor.reconcile()
      await processor.drain()
      const paid = (await new PurchaseRepository().get(purchase.id))!
      assert.equal(paid.status, 'paid')
      assert.isNotNull(paid.access_id)
    }
    const hashBefore = user.password
    await BenefitAccess.query().where('id', receipt.courtesyAccessId).update({
      status: 'revoked',
      revoked_by: administrator.id,
      revoked_at: new Date(),
      revocation_reason: 'test',
    })
    await EstablishmentRevisionMedia.query().where('media_asset_id', assets[0].id).update({
      moderation_status: 'quarantined',
      is_cover: false,
      review_notes: 'Quarantined by test moderator',
    })
    const edition = await BenefitEdition.findOrFail(receipt.editionIds[1])
    const originalEnd = edition.usage_ends_at.toISO()
    input.accounts.customer.password = randomBytes(32).toString('base64url') + 'aB7'
    const again = await service.run(input)
    assert.deepEqual(again, { ...receipt, created: false })
    await user.refresh()
    await edition.refresh()
    assert.equal(user.password, hashBefore)
    assert.equal(edition.usage_ends_at.toISO(), originalEnd)
    const revoked = await BenefitAccess.findOrFail(receipt.courtesyAccessId)
    assert.equal(revoked.status, 'revoked')
    const quarantined = await EstablishmentRevisionMedia.findByOrFail(
      'media_asset_id',
      assets[0].id
    )
    assert.equal(quarantined.moderation_status, 'quarantined')
    assert.lengthOf(await BenefitOffer.query().where('tenant_id', receipt.tenantId), 4)
  })

  test('refuses adopting a tenant or an existing account and rolls back the entire database bootstrap', async ({
    assert,
    cleanup,
  }) => {
    deployment('homologation')
    const input = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', input.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const existing = await User.create({
      full_name: 'Existing',
      email: input.accounts.administrator.email,
      password: input.accounts.administrator.password,
    })
    await assert.rejects(() => new HomologationProvisioningService().run(input), /never adopts/)
    assert.isNull(await Tenant.findBy('slug', input.tenantSlug))
    await existing.load('roles')
    assert.lengthOf(existing.roles, 0)
    await Tenant.create({ slug: input.tenantSlug, name: 'Existing tenant' })
    await assert.rejects(
      () => new HomologationProvisioningService().run(input),
      /automatic adoption/
    )
  })

  test('late publication failure rolls back accounts, tenant and relational content', async ({
    assert,
    cleanup,
  }) => {
    deployment('homologation')
    const input = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', input.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    mock.method(BenefitEdition, 'create', () => {
      throw new Error('private database diagnostic must not escape')
    })
    await assert.rejects(
      () => new HomologationProvisioningService().run(input),
      /^Provisioning failed;/
    )
    assert.isNull(await Tenant.findBy('slug', input.tenantSlug))
    assert.isNull(await db.from('users').where('email', input.accounts.administrator.email).first())
  })
})

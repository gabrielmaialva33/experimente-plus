import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import User from '#modules/users/models/user'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import HomologationProvisioningService from '#modules/tenants/services/homologation_provisioning_service'
import {
  ACCOUNT_KINDS,
  parseProvisioningConfig,
  type HomologationProvisioningConfig,
} from '#modules/tenants/services/homologation_provisioning_config'
import { useFakePayments } from '#tests/helpers/fake_payments'
import ProvisionTestAccounts from '../../../commands/provision_test_accounts.js'

function configuration(local = false): HomologationProvisioningConfig {
  const accounts = {} as HomologationProvisioningConfig['accounts']
  // Deliberately short/shared in the opt-in fixture, but generated afresh: no fixed credential.
  const password = local ? randomBytes(6).toString('hex') : ''
  for (const kind of ACCOUNT_KINDS)
    accounts[kind] = {
      fullName: 'Test account ' + kind,
      email: randomUUID() + (local ? '@example.local' : '@example.test'),
      password: local ? password : randomBytes(32).toString('base64url') + 'aB7',
    }
  return {
    tenantSlug: 'accounts-' + randomUUID().slice(0, 8),
    tenantName: 'Test accounts operation',
    accounts,
  }
}

function deployment(value: string | undefined) {
  const original = env.get.bind(env)
  return mock.method(env, 'get', (key: string, fallback?: unknown) => {
    if (key === 'DEPLOYMENT_ENV') return value
    if (key === 'BENEFIT_PRESENTATION_BASE_URL') return 'https://test-accounts.example.test'
    return original(key as 'NODE_ENV', fallback as never)
  })
}

async function command(configPath: string, allow = true) {
  const instance = await ace.create(ProvisionTestAccounts, [
    '--config=' + configPath,
    ...(allow ? ['--allow-test-accounts'] : []),
  ])
  const messages: string[] = []
  for (const method of ['error', 'warning', 'success', 'info'] as const)
    mock.method(instance.logger, method, (message: string) => {
      messages.push(message)
    })
  await instance.exec()
  return { code: instance.exitCode ?? 0, messages }
}

test.group('Explicit non-production test accounts command', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())

  test('requires explicit opt-in and refuses production, missing or invalid deployment before reading configuration', async ({
    assert,
  }) => {
    for (const value of ['production', undefined, 'invalid']) {
      const policy = deployment(value)
      const result = await command('/does-not-exist/private.json')
      assert.equal(result.code, 1)
      assert.include(
        result.messages.join(' '),
        'production, missing and invalid environments are refused'
      )
      policy.mock.restore()
    }
    deployment('homologation')
    const absent = await command('/does-not-exist/private.json', false)
    assert.equal(absent.code, 1)
    assert.include(absent.messages.join(' '), '--allow-test-accounts')
    const config = configuration(true)
    assert.throws(() => parseProvisioningConfig(config))
    assert.isTrue(JSON.stringify(parseProvisioningConfig(config, true)) === JSON.stringify(config))
    const service = new HomologationProvisioningService()
    await assert.rejects(() => service.run(config), /Invalid provisioning/)
  })

  test('adds three local test identities to a provisioned baseline; real logins exercise root, partner validation/history and consumer wallet; replay never restores rights', async ({
    assert,
    client,
    cleanup,
  }) => {
    const policy = deployment('homologation')
    const nominal = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', nominal.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const service = new HomologationProvisioningService()
    const baseline = await service.run(nominal)
    const config = {
      ...configuration(true),
      tenantSlug: nominal.tenantSlug,
      tenantName: nominal.tenantName,
    }
    const dir = await mkdtemp(join(tmpdir(), 'test-accounts-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const path = join(dir, 'private.json')
    await writeFile(path, JSON.stringify(config), { mode: 0o600 })
    const first = await command(path)
    assert.equal(first.code, 0)
    const receipt = JSON.parse(first.messages.find((message) => message.startsWith('{'))!)
    assert.isTrue(receipt.created)
    assert.equal(receipt.tenantId, baseline.tenantId)
    assert.notEqual(receipt.accounts.administrator, baseline.accounts.administrator)
    for (const kind of ACCOUNT_KINDS) {
      assert.isFalse(first.messages.join(' ').includes(config.accounts[kind].email))
      assert.isFalse(first.messages.join(' ').includes(config.accounts[kind].password))
    }
    const tokens = {} as Record<(typeof ACCOUNT_KINDS)[number], string>
    for (const kind of ACCOUNT_KINDS) {
      const login = await client
        .post('/api/v1/sessions/sign-in')
        .json({ uid: config.accounts[kind].email, password: config.accounts[kind].password })
      login.assertStatus(200)
      tokens[kind] = login.body().auth.access_token
    }
    const root = await User.findOrFail(receipt.accounts.administrator)
    await root.load('roles')
    assert.deepEqual(
      root.roles.map((role) => role.slug),
      ['root']
    )
    const admin = await client.get('/api/v1/admin/roles').bearerToken(tokens.administrator)
    admin.assertStatus(200)
    const context = await client.get('/api/v1/me/context').bearerToken(tokens.partner)
    context.assertStatus(200)
    assert.deepEqual(context.body().capabilities.partner.redemptions, {
      read: true,
      validate: true,
    })
    const wallet = await client.get('/api/v1/me/wallet').bearerToken(tokens.customer)
    wallet.assertStatus(200)
    assert.lengthOf(wallet.body().passes, 1)
    const pass = wallet.body().passes[0]
    assert.equal(pass.access.id, receipt.courtesyAccessId)
    assert.isNotEmpty(pass.benefits)
    const presentation = await client
      .post('/api/v1/me/benefits/presentations')
      .bearerToken(tokens.customer)
      .json({ access_id: pass.access.id, offer_id: pass.benefits[0].offer_id })
    presentation.assertStatus(201)
    const payload = { token: presentation.body().token }
    const preview = await client
      .post('/api/v1/benefit-redemptions/preview')
      .bearerToken(tokens.partner)
      .json(payload)
    preview.assertStatus(200)
    const redeemed = await client
      .post('/api/v1/benefit-redemptions')
      .bearerToken(tokens.partner)
      .json(payload)
    redeemed.assertStatus(200)
    const history = await client.get('/api/v1/benefit-redemptions').bearerToken(tokens.partner)
    history.assertStatus(200)
    assert.include(JSON.stringify(history.body()), redeemed.body().receipt_code)
    const previousHash = root.password
    await root.related('roles').detach()
    await BenefitAccess.query().where('id', receipt.courtesyAccessId).update({
      status: 'revoked',
      revoked_by: baseline.accounts.administrator,
      revoked_at: new Date(),
      revocation_reason: 'test',
    })
    config.accounts.administrator.password = randomBytes(32).toString('hex')
    await writeFile(path, JSON.stringify(config), { mode: 0o600 })
    const repeated = await command(path)
    assert.equal(repeated.code, 0)
    assert.deepEqual(JSON.parse(repeated.messages.find((message) => message.startsWith('{'))!), {
      ...receipt,
      created: false,
    })
    await root.refresh()
    await root.load('roles')
    assert.lengthOf(root.roles, 0)
    assert.isTrue(root.password === previousHash)
    const revokedAccess = await BenefitAccess.findOrFail(receipt.courtesyAccessId)
    assert.equal(revokedAccess.status, 'revoked')
    assert.lengthOf(
      await User.query().whereIn(
        'email',
        ACCOUNT_KINDS.map((kind) => config.accounts[kind].email)
      ),
      3
    )
    policy.mock.restore()
    deployment('production')
    const refused = await command(path)
    assert.equal(refused.code, 1)
    assert.include(refused.messages.join(' '), 'production, missing and invalid')
  })

  test('refuses a missing baseline and never adopts or elevates an existing identity', async ({
    assert,
    cleanup,
  }) => {
    deployment('homologation')
    const nominal = configuration()
    const config = {
      ...configuration(true),
      tenantSlug: nominal.tenantSlug,
      tenantName: nominal.tenantName,
    }
    const service = new HomologationProvisioningService()
    await assert.rejects(() => service.provisionTestAccounts(config, true), /provisioned tenant/)
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', nominal.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    await service.run(nominal)
    await User.create({
      full_name: config.accounts.partner.fullName,
      email: config.accounts.partner.email,
      password: config.accounts.partner.password,
    })
    await assert.rejects(() => service.provisionTestAccounts(config, true), /never adopts/)
    assert.isNull(await User.findBy('email', config.accounts.administrator.email))
    assert.isNull(await User.findBy('email', config.accounts.customer.email))
  })
  test('late grant failure rolls back all test accounts, memberships and receipt', async ({
    assert,
    cleanup,
  }) => {
    deployment('homologation')
    const nominal = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', nominal.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const service = new HomologationProvisioningService()
    await service.run(nominal)
    const config = {
      ...configuration(true),
      tenantSlug: nominal.tenantSlug,
      tenantName: nominal.tenantName,
    }
    const failure = mock.method(BenefitAccess, 'create', async () => {
      throw new Error('Simulated grant failure')
    })
    await assert.rejects(() => service.provisionTestAccounts(config, true), /provisioning failed/)
    assert.lengthOf(
      await User.query().whereIn(
        'email',
        ACCOUNT_KINDS.map((kind) => config.accounts[kind].email)
      ),
      0
    )
    failure.mock.restore()
    const result = await service.provisionTestAccounts(config, true)
    assert.isTrue(result.created)
  })
})

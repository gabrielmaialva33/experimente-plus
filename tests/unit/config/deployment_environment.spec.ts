import { randomBytes } from 'node:crypto'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import env from '#start/env'
import { deploymentEnvironment, isHostedDeployment } from '#shared/utils/deployment_environment'
import { assertBenefitPresentationOriginConfiguration } from '#shared/utils/benefit_presentation_origin'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import { PaymentConfigurationException } from '#modules/purchases/exceptions'
import DevelopmentSeeder from '#database/seeders/development_seeder'
import { createPurchaseFixture } from '#database/factories/scenarios/purchase_flow_factory'

function configuration(values: Record<string, unknown>) {
  const original = env.get.bind(env)
  mock.method(env, 'get', (key: string, fallback?: string) =>
    Object.hasOwn(values, key) ? values[key] : (original(key) ?? fallback)
  )
}

test.group('Business deployment policy independent of runtime', (group) => {
  group.each.teardown(() => mock.restoreAll())

  test('missing deployment fails closed and invalid values never fall back to development', ({
    assert,
  }) => {
    assert.equal(deploymentEnvironment(), 'production')
    assert.isTrue(isHostedDeployment())
    for (const value of ['', 'test', 'Production', 'unknown']) {
      assert.throws(() => deploymentEnvironment(value), /DEPLOYMENT_ENV/)
    }
    assert.isFalse(isHostedDeployment('development'))
    assert.isTrue(isHostedDeployment('homologation'))
    assert.isTrue(isHostedDeployment('production'))
  })

  test('compiled homologation accepts test Stripe while business production rejects it', ({
    assert,
  }) => {
    const values = {
      NODE_ENV: 'production',
      DEPLOYMENT_ENV: 'homologation',
      PAYMENT_PROVIDER: 'stripe',
      PAYMENT_ENVIRONMENT: 'test',
      STRIPE_ENVIRONMENT: 'test',
      STRIPE_SECRET_KEY: 'sk_test_' + randomBytes(32).toString('hex'),
      STRIPE_ACCOUNT_ID: 'acct_' + randomBytes(12).toString('hex'),
      STRIPE_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
    }
    configuration(values)
    assert.equal(new PaymentProviderService().get().environment, 'test')
    values.DEPLOYMENT_ENV = 'production'
    assert.throws(() => new PaymentProviderService().get(), /live payment/)
    values.NODE_ENV = 'development'
    assert.throws(() => new PaymentProviderService().get(), /live payment/)
    values.PAYMENT_ENVIRONMENT = 'live'
    values.STRIPE_ENVIRONMENT = 'live'
    assert.throws(() => new PaymentProviderService().get(), /key does not match/)
    values.STRIPE_SECRET_KEY = 'sk_live_' + randomBytes(32).toString('hex')
    assert.equal(new PaymentProviderService().get().environment, 'live')
  })

  test('fake is permitted in compiled homologation and forbidden in business production or absence', ({
    assert,
  }) => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'production',
      DEPLOYMENT_ENV: 'homologation',
      PAYMENT_PROVIDER: 'fake',
    }
    configuration(values)
    assert.instanceOf(new PaymentProviderService().get(), FakePaymentAdapter)
    for (const deployment of ['production', undefined]) {
      values.DEPLOYMENT_ENV = deployment
      assert.throws(() => new FakePaymentAdapter(), PaymentConfigurationException)
      assert.throws(() => new PaymentProviderService().get(), PaymentConfigurationException)
    }
  })

  test('homologation still requires a webhook secret; test runtime still blocks real transport', ({
    assert,
  }) => {
    const values = {
      NODE_ENV: 'production',
      DEPLOYMENT_ENV: 'homologation',
      PAYMENT_PROVIDER: 'stripe',
      PAYMENT_ENVIRONMENT: 'test',
      STRIPE_ENVIRONMENT: 'test',
      STRIPE_SECRET_KEY: 'sk_test_' + randomBytes(32).toString('hex'),
      STRIPE_ACCOUNT_ID: 'acct_' + randomBytes(12).toString('hex'),
      STRIPE_WEBHOOK_SECRET: undefined,
    }
    configuration(values)
    assert.throws(() => new PaymentProviderService().get(), /webhook verification/)
    values.DEPLOYMENT_ENV = 'development'
    assert.equal(new PaymentProviderService().get().environment, 'test')
    values.NODE_ENV = 'test'
    assert.throws(() => new PaymentProviderService().get(), /test application/)
  })

  test('hosted deployments require canonical HTTPS regardless of runtime', ({ assert }) => {
    for (const environment of ['homologation', 'production'] as const) {
      assert.throws(() => assertBenefitPresentationOriginConfiguration({ environment }), /APP_URL/)
      assert.throws(
        () =>
          assertBenefitPresentationOriginConfiguration({
            environment,
            appUrl: 'http://example.com',
          }),
        /HTTPS/
      )
      assert.doesNotThrow(() =>
        assertBenefitPresentationOriginConfiguration({ environment, appUrl: 'https://example.com' })
      )
    }
  })

  test('development data fabrication is rejected before any database access on hosted deployments', async ({
    assert,
  }) => {
    configuration({ DEPLOYMENT_ENV: 'homologation', PAYMENT_PROVIDER: 'fake' })
    await assert.rejects(() => DevelopmentSeeder.prototype.run(), /DEPLOYMENT_ENV=development/)
    await assert.rejects(() => createPurchaseFixture(), /fake/)
  })
})

import { mock } from 'node:test'
import { test } from '@japa/runner'

import { paymentSimulationAvailable } from '#modules/purchases/services/purchase_simulation_service'
import env from '#start/env'

function configuration(values: Record<string, unknown>) {
  const original = env.get.bind(env)
  mock.method(env, 'get', (key: string, fallback?: string) =>
    Object.hasOwn(values, key) ? values[key] : (original(key as never) ?? fallback)
  )
}

test.group('Simulated payment availability', (group) => {
  group.each.teardown(() => mock.restoreAll())

  test('exists only with the fake provider outside production', ({ assert }) => {
    const matrix: Array<[string | undefined, string | undefined, boolean]> = [
      ['development', 'fake', true],
      ['homologation', 'fake', true],
      ['production', 'fake', false],
      // A missing deployment is production.
      [undefined, 'fake', false],
      ['homologation', 'disabled', false],
      ['homologation', 'stripe', false],
      ['homologation', 'mercado_pago', false],
      ['development', undefined, false],
    ]

    for (const [deployment, provider, expected] of matrix) {
      mock.restoreAll()
      configuration({ DEPLOYMENT_ENV: deployment, PAYMENT_PROVIDER: provider })
      assert.equal(
        paymentSimulationAvailable(),
        expected,
        `DEPLOYMENT_ENV=${deployment} PAYMENT_PROVIDER=${provider}`
      )
    }
  })

  test('an unreadable deployment value never enables it', ({ assert }) => {
    configuration({ DEPLOYMENT_ENV: 'staging', PAYMENT_PROVIDER: 'fake' })
    assert.isFalse(paymentSimulationAvailable())
  })
})

import { test } from '@japa/runner'
import env from '#start/env'
import { useFakePayments } from '#tests/helpers/fake_payments'

test.group('Payment test environment isolation', () => {
  for (const provider of [undefined, 'disabled', 'stripe'] as const) {
    test(
      'restores provider and process environment, including original absence: ' + provider,
      ({ assert }) => {
        const prior = env.get('PAYMENT_PROVIDER')
        const priorProcess = process.env.PAYMENT_PROVIDER
        try {
          env.set('PAYMENT_PROVIDER', provider)
          if (provider === undefined) delete process.env.PAYMENT_PROVIDER
          const previousMethods = env.get('PAYMENT_METHODS')
          const previousPolicy = env.get('PURCHASE_AUTO_REFUND_UNUSED')
          const release = useFakePayments({ autoRefundUnused: true })
          try {
            assert.equal(env.get('PAYMENT_PROVIDER'), 'fake')
            assert.equal(env.get('PAYMENT_METHODS'), 'pix,card')
            assert.isTrue(env.get('PURCHASE_AUTO_REFUND_UNUSED'))
            const releaseNested = useFakePayments()
            assert.isFalse(env.get('PURCHASE_AUTO_REFUND_UNUSED'))
            releaseNested()
            assert.isTrue(env.get('PURCHASE_AUTO_REFUND_UNUSED'))
          } finally {
            release()
          }
          assert.equal(env.get('PAYMENT_PROVIDER'), provider)
          assert.equal(process.env.PAYMENT_PROVIDER, provider)
          assert.equal(env.get('PAYMENT_METHODS'), previousMethods)
          assert.equal(env.get('PURCHASE_AUTO_REFUND_UNUSED'), previousPolicy)
        } finally {
          env.set('PAYMENT_PROVIDER', prior)
          if (priorProcess === undefined) delete process.env.PAYMENT_PROVIDER
          else process.env.PAYMENT_PROVIDER = priorProcess
        }
      }
    )
  }
})

import env from '#start/env'

/** Each payment test owns its simulated provider and commercial policy, including cleanup. */
export function useFakePayments(options: { autoRefundUnused?: boolean } = {}): () => void {
  if (env.get('NODE_ENV') !== 'test')
    throw new Error('Fake payment test setup requires NODE_ENV=test')
  const previous = {
    provider: env.get('PAYMENT_PROVIDER'),
    methods: env.get('PAYMENT_METHODS'),
    automaticRefund: env.get('PURCHASE_AUTO_REFUND_UNUSED'),
  }
  const keys = ['PAYMENT_PROVIDER', 'PAYMENT_METHODS', 'PURCHASE_AUTO_REFUND_UNUSED'] as const
  const processValues = keys.map((key) => process.env[key])
  env.set('PAYMENT_PROVIDER', 'fake')
  env.set('PAYMENT_METHODS', 'pix,card')
  env.set('PURCHASE_AUTO_REFUND_UNUSED', options.autoRefundUnused ?? false)
  return () => {
    // No fallback here: an absent/disabled provider must not become fake for the next suite.
    env.set('PAYMENT_PROVIDER', previous.provider)
    env.set('PAYMENT_METHODS', previous.methods)
    env.set('PURCHASE_AUTO_REFUND_UNUSED', previous.automaticRefund)
    // Env.set mirrors undefined as a string in process.env; restore true absence as well.
    for (const [index, key] of keys.entries()) {
      if (processValues[index] === undefined) delete process.env[key]
      else process.env[key] = processValues[index]
    }
  }
}

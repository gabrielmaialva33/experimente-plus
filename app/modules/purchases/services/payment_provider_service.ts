import { PaymentUnavailableException } from '#modules/purchases/exceptions'
import env from '#start/env'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import MercadoPagoAdapter from '#modules/purchases/adapters/mercado_pago_adapter'
import type { PaymentPort } from '#modules/purchases/interfaces/payment_port'

export default class PaymentProviderService {
  get(): PaymentPort {
    const selected = env.get('PAYMENT_PROVIDER', 'disabled')
    if (selected === 'fake') return new FakePaymentAdapter()
    if (selected !== 'mercado_pago')
      throw new PaymentUnavailableException(
        'Purchases are disabled until a payment provider is configured'
      )
    if (env.get('NODE_ENV') === 'test')
      throw new PaymentUnavailableException(
        'Real payment transport is forbidden in the test application'
      )
    if (env.get('NODE_ENV') === 'production' && env.get('PAYMENT_ENVIRONMENT', 'test') !== 'live')
      throw new PaymentUnavailableException('Production requires live payment evidence')
    const account = env.get('MERCADO_PAGO_ACCOUNT_ID')
    const token = env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const secret = env.get('MERCADO_PAGO_WEBHOOK_SECRET')
    if (!account || !token || !secret)
      throw new PaymentUnavailableException('Incomplete payment provider configuration')
    return new MercadoPagoAdapter(account, env.get('PAYMENT_ENVIRONMENT', 'test'), token, secret)
  }
}

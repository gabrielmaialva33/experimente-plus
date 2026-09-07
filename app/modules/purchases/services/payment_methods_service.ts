import { inject } from '@adonisjs/core'
import env from '#start/env'
import { PaymentUnavailableException } from '#modules/purchases/exceptions'
import type BenefitEdition from '#modules/benefits/models/benefit_edition'
import type { PaymentMethod } from '#modules/purchases/interfaces/payment_port'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'

/** Local sell-side capability, shared by the public quote and private purchase command. */
@inject()
export default class PaymentMethodsService {
  constructor(private providers: PaymentProviderService) {}

  forEdition(edition: BenefitEdition): PaymentMethod[] {
    if (edition.currency !== 'BRL' || edition.price_cents <= 0) return []
    try {
      // Constructing the configured port never calls the PSP or exposes its account/secrets.
      const provider = this.providers.get()
      // Real accounts advertise only methods explicitly enabled after commercial verification.
      const enabled = env.get('PAYMENT_METHODS', provider.name === 'fake' ? 'pix,card' : 'none')
      if (enabled === 'none') return []
      return enabled
        .split(',')
        .filter((method): method is PaymentMethod => method === 'pix' || method === 'card')
    } catch (error) {
      if (error instanceof PaymentUnavailableException) return []
      throw error
    }
  }
}

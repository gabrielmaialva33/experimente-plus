import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import type { Purchase } from '#modules/purchases/models/purchase'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import type User from '#modules/users/models/user'
import { deploymentEnvironment } from '#shared/utils/deployment_environment'
import env from '#start/env'

/**
 * Whether this deployment may confirm simulated payments: the configured
 * provider is the fake one and the deployment is not production. Read on
 * every call, never cached, so a configuration change cannot leave the action
 * behind. An unreadable `DEPLOYMENT_ENV` counts as production.
 */
export function paymentSimulationAvailable(): boolean {
  let deployment: ReturnType<typeof deploymentEnvironment>
  try {
    deployment = deploymentEnvironment(env.get('DEPLOYMENT_ENV'))
  } catch {
    return false
  }
  return deployment !== 'production' && env.get('PAYMENT_PROVIDER', 'disabled') === 'fake'
}

/**
 * Confirms a payment of the fake provider (development and homologation).
 *
 * `confirm` is exactly what `purchases:simulate` does: it settles the queued
 * commands, marks the simulated payment as paid at the provider and runs the
 * same reconciliation the scheduler runs (`reconcile` then `drain`). The
 * access is therefore born only where it is always born — in
 * `PurchaseProcessingService`, from what the provider port reports — never
 * written here.
 */
@inject()
export default class PurchaseSimulationService {
  constructor(
    private providers: PaymentProviderService,
    private processing: PurchaseProcessingService,
    private repository: PurchaseRepository,
    private policy: OrganizationPolicyService
  ) {}

  get available(): boolean {
    return paymentSimulationAvailable()
  }

  async confirm(purchaseId: string) {
    if (deploymentEnvironment(env.get('DEPLOYMENT_ENV')) === 'production')
      throw new Error('Simulation is forbidden in production')
    const port = this.providers.get()
    if (!(port instanceof FakePaymentAdapter)) throw new Error('Select PAYMENT_PROVIDER=fake')

    await this.processing.drain()
    await port.simulate('fake_' + purchaseId, {
      state: 'paid',
      paidAt: new Date().toISOString(),
    })
    await this.processing.reconcile()
    return this.processing.drain()
  }

  /**
   * The back-office action: a platform administrator confirms one pending,
   * simulated order of this operation. The request is recorded in the
   * purchase's own append-only history, with the administrator as actor,
   * before the provider is touched; the outcome events follow from the
   * reconciliation as for any payment.
   */
  async confirmForOperation(tenantId: number, actor: User, purchaseId: string): Promise<Purchase> {
    await this.policy.requirePlatformAdmin(actor)
    if (!this.available) {
      throw new NotFoundException('Payment simulation is not available in this environment')
    }

    await db.transaction(async (client) => {
      const purchase = await this.repository.get(purchaseId, client, true)
      if (!purchase || purchase.tenant_id !== tenantId) {
        throw new NotFoundException('Purchase not found')
      }
      if (purchase.provider !== 'fake') {
        throw new BadRequestException('Only simulated purchases can be confirmed here')
      }
      if (purchase.status !== 'pending' || purchase.paid_at) {
        throw new BadRequestException('Only pending purchases can be confirmed')
      }
      if (purchase.expires_at <= new Date()) {
        throw new BadRequestException('The purchase quote has expired')
      }
      await this.repository.audit(
        purchase,
        'payment_simulation_requested',
        { state: 'paid', source: 'backoffice' },
        client,
        actor.id
      )
    })

    try {
      await this.confirm(purchaseId)
    } catch (error) {
      // The provider has no payment for the order yet (its creation is still
      // queued or was deferred). The request stays in the history.
      if ((error as { code?: string }).code !== 'E_ROW_NOT_FOUND') throw error
      throw new BadRequestException('The simulated payment could not be confirmed yet')
    }

    return (await this.repository.get(purchaseId))!
  }
}

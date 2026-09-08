import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import PurchaseOperationsService from '#modules/purchases/services/purchase_operations_service'
import PurchaseService from '#modules/purchases/services/purchase_service'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import {
  purchaseValidator,
  refundValidator,
  refundDecisionValidator,
  purchaseIdValidator,
  reconciliationValidator,
  settlementValidator,
} from '#modules/purchases/validators/purchase_validator'

@inject()
export default class PurchasesController {
  constructor(
    private purchases: PurchaseService,
    private processing: PurchaseProcessingService,
    private operationsService: PurchaseOperationsService
  ) {}
  async catalog({ request }: HttpContext) {
    return this.purchases.catalog(request.hostname())
  }
  async index({ tenant, auth }: HttpContext) {
    return this.purchases.list(tenant!.id, auth.getUserOrFail())
  }
  async show({ tenant, auth, params }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)
    return this.purchases.get(tenant!.id, auth.getUserOrFail(), id)
  }
  async store({ tenant, auth, request, response }: HttpContext) {
    const input = await request.validateUsing(purchaseValidator)
    return response.accepted(
      await this.purchases.create(
        tenant!.id,
        auth.getUserOrFail(),
        request.header('idempotency-key') ?? '',
        { ...input, email: auth.getUserOrFail().email }
      )
    )
  }
  async cancel({ tenant, auth, params, request, response }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)
    return response.accepted(
      await this.purchases.cancel(
        tenant!.id,
        auth.getUserOrFail(),
        id,
        request.header('idempotency-key') ?? ''
      )
    )
  }
  async refund({ tenant, auth, params, request, response }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)
    const { reason } = await request.validateUsing(refundValidator)
    return response.accepted(
      await this.purchases.refund(
        tenant!.id,
        auth.getUserOrFail(),
        id,
        request.header('idempotency-key') ?? '',
        reason
      )
    )
  }
  async decide({ tenant, auth, params, request }: HttpContext) {
    const { id, refundId } = await purchaseIdValidator.validate(params)
    const input = await request.validateUsing(refundDecisionValidator)
    return this.purchases.decideRefund(tenant!.id, auth.getUserOrFail(), id, refundId!, input)
  }
  async operations({ tenant, auth }: HttpContext) {
    return this.purchases.operations(tenant!.id, auth.getUserOrFail())
  }
  async detail({ tenant, auth, params }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)
    return this.operationsService.detail(tenant!.id, auth.getUserOrFail(), id)
  }
  async retry({ tenant, auth, params, request, response }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)
    const input = await request.validateUsing(reconciliationValidator)
    return response.accepted(
      await this.operationsService.retry(
        tenant!.id,
        auth.getUserOrFail(),
        id,
        request.header('idempotency-key') ?? '',
        input
      )
    )
  }
  async settlement({ tenant, auth, request }: HttpContext) {
    return this.operationsService.settlement(
      tenant!.id,
      auth.getUserOrFail(),
      await request.validateUsing(settlementValidator)
    )
  }
  async reconciliation({ tenant, auth }: HttpContext) {
    return this.operationsService.reconciliation(tenant!.id, auth.getUserOrFail())
  }
  async webhook({ request, response, params }: HttpContext) {
    return response.accepted(
      await this.processing.webhook(
        params.provider,
        {
          'x-signature': request.header('x-signature'),
          'x-request-id': request.header('x-request-id'),
          'x-fake-signature': request.header('x-fake-signature'),
          'stripe-signature': request.header('stripe-signature'),
        },
        params.provider === 'stripe' ? request.raw() : request.body(),
        request.qs()
      )
    )
  }
}

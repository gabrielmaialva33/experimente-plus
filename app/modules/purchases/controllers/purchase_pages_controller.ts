import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BadRequestException from '#exceptions/bad_request_exception'
import PurchasePagesService from '#modules/purchases/services/purchase_pages_service'
import PurchaseSimulationService from '#modules/purchases/services/purchase_simulation_service'
import {
  listPurchasePagesValidator,
  purchaseIdValidator,
} from '#modules/purchases/validators/purchase_validator'

const SIMULATION_ERRORS: Record<string, string> = {
  'Only simulated purchases can be confirmed here':
    'Este pedido não usa o pagamento simulado, por isso não pode ser confirmado aqui.',
  'Only pending purchases can be confirmed':
    'Este pedido não está mais aguardando pagamento. Atualize a lista para ver a situação atual.',
  'The purchase quote has expired':
    'O prazo de pagamento deste pedido acabou. Peça para a pessoa fazer um novo pedido no app.',
  'The simulated payment could not be confirmed yet':
    'O pedido ainda está sendo registrado. Espere um minuto e tente de novo.',
}

/**
 * "Pedidos" in the back office: the operation's orders for platform
 * administrators and, in development and homologation only, the confirmation
 * of a simulated payment — the button version of `purchases:simulate`.
 */
@inject()
export default class PurchasePagesController {
  constructor(
    private pages: PurchasePagesService,
    private simulation: PurchaseSimulationService
  ) {}

  async index({ auth, inertia, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listPurchasePagesValidator)
    const page = await this.pages.list(tenant!.id, auth.getUserOrFail(), {
      status: query.status,
      page: query.page,
    })

    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    return inertia.render('backoffice/purchases/index', page)
  }

  async confirmSimulatedPayment({ auth, params, response, session, tenant }: HttpContext) {
    const { id } = await purchaseIdValidator.validate(params)

    try {
      const purchase = await this.simulation.confirmForOperation(
        tenant!.id,
        auth.getUserOrFail(),
        id
      )
      session.flash(
        'success',
        purchase.status === 'paid'
          ? 'Pagamento simulado confirmado. O acesso já está na carteira da pessoa.'
          : 'Pagamento simulado registrado. A conciliação ainda não liberou o acesso; confira a situação do pedido.'
      )
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error
      session.flash(
        'error',
        SIMULATION_ERRORS[error.message] ??
          'Não foi possível confirmar o pagamento simulado. Atualize a lista e tente de novo.'
      )
    }

    return response.redirect().back()
  }
}

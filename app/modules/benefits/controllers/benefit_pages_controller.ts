import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import BenefitOfferService from '#modules/benefits/services/benefit_offer_service'
import BenefitPagesService from '#modules/benefits/services/benefit_pages_service'
import {
  createBenefitEditionValidator,
  createBenefitOfferValidator,
  updateBenefitEditionValidator,
  updateBenefitOfferValidator,
} from '#modules/benefits/validators/benefit_validator'

@inject()
export default class BenefitPagesController {
  constructor(
    private editionService: BenefitEditionService,
    private offerService: BenefitOfferService,
    private pagesService: BenefitPagesService
  ) {}

  async backoffice({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const page = await this.pagesService.backoffice(tenant!.id, auth.getUserOrFail())

    return inertia.render('backoffice/benefits/index', page)
  }

  async createEdition({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createBenefitEditionValidator)
    await this.editionService.create(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Edição criada. Agora vincule e ative as ofertas participantes.')
    return response.redirect().toPath('/backoffice/benefits')
  }

  async updateEdition({ auth, params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateBenefitEditionValidator)
    await this.editionService.update(
      tenant!.id,
      Number(params.editionId),
      auth.getUserOrFail(),
      payload
    )
    session.flash('success', 'Dados da edição atualizados.')
    return response.redirect().back()
  }

  async publishEdition({ auth, params, response, session, tenant }: HttpContext) {
    await this.editionService.publish(tenant!.id, Number(params.editionId), auth.getUserOrFail())
    session.flash('success', 'Edição publicada para a operação.')
    return response.redirect().back()
  }

  async pauseEdition({ auth, params, response, session, tenant }: HttpContext) {
    await this.editionService.pause(tenant!.id, Number(params.editionId), auth.getUserOrFail())
    session.flash('success', 'Edição pausada. As ofertas permanecem preservadas.')
    return response.redirect().back()
  }

  async archiveEdition({ auth, params, response, session, tenant }: HttpContext) {
    await this.editionService.archive(tenant!.id, Number(params.editionId), auth.getUserOrFail())
    session.flash('success', 'Edição arquivada sem apagar o histórico.')
    return response.redirect().back()
  }

  async establishment({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const page = await this.pagesService.establishment(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail()
    )

    return inertia.render('portal/establishments/benefits', page)
  }

  async createOffer({ auth, params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createBenefitOfferValidator)
    await this.offerService.create(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload
    )
    session.flash('success', 'Oferta criada em rascunho. Revise os termos antes de ativar.')
    return response.redirect().back()
  }

  async updateOffer({ auth, params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateBenefitOfferValidator)
    await this.offerService.update(
      tenant!.id,
      Number(params.offerId),
      auth.getUserOrFail(),
      payload
    )
    session.flash('success', 'Oferta atualizada com os novos termos.')
    return response.redirect().back()
  }

  async activateOffer({ auth, params, response, session, tenant }: HttpContext) {
    await this.offerService.activate(tenant!.id, Number(params.offerId), auth.getUserOrFail())
    session.flash('success', 'Oferta ativada e pronta para compor a edição.')
    return response.redirect().back()
  }

  async pauseOffer({ auth, params, response, session, tenant }: HttpContext) {
    await this.offerService.pause(tenant!.id, Number(params.offerId), auth.getUserOrFail())
    session.flash('success', 'Oferta pausada. Agora os termos podem ser revisados.')
    return response.redirect().back()
  }

  async archiveOffer({ auth, params, response, session, tenant }: HttpContext) {
    await this.offerService.archive(tenant!.id, Number(params.offerId), auth.getUserOrFail())
    session.flash('success', 'Oferta arquivada sem perder o histórico.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}

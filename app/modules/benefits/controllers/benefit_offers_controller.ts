import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitOfferService from '#modules/benefits/services/benefit_offer_service'
import {
  createBenefitOfferValidator,
  updateBenefitOfferValidator,
} from '#modules/benefits/validators/benefit_validator'

@inject()
export default class BenefitOffersController {
  constructor(private offerService: BenefitOfferService) {}

  async index({ auth, params, response, tenant }: HttpContext) {
    const offers = await this.offerService.listForEstablishment(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail()
    )
    return response.ok(offers)
  }

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createBenefitOfferValidator)
    const offer = await this.offerService.create(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload
    )
    return response.created(offer)
  }

  async show({ auth, params, response, tenant }: HttpContext) {
    const offer = await this.offerService.show(tenant!.id, Number(params.id), auth.getUserOrFail())
    return response.ok(offer)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateBenefitOfferValidator)
    const offer = await this.offerService.update(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(offer)
  }

  async activate({ auth, params, response, tenant }: HttpContext) {
    const offer = await this.offerService.activate(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(offer)
  }

  async pause({ auth, params, response, tenant }: HttpContext) {
    const offer = await this.offerService.pause(tenant!.id, Number(params.id), auth.getUserOrFail())
    return response.ok(offer)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    const offer = await this.offerService.archive(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(offer)
  }
}

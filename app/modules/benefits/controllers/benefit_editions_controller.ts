import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import {
  createBenefitEditionValidator,
  updateBenefitEditionValidator,
} from '#modules/benefits/validators/benefit_validator'

@inject()
export default class BenefitEditionsController {
  constructor(private editionService: BenefitEditionService) {}

  async available({ response, tenant }: HttpContext) {
    const editions = await this.editionService.listAvailable(tenant!.id)
    return response.ok(editions)
  }

  async index({ auth, response, tenant }: HttpContext) {
    const editions = await this.editionService.list(tenant!.id, auth.getUserOrFail())
    return response.ok(editions)
  }

  async store({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createBenefitEditionValidator)
    const edition = await this.editionService.create(tenant!.id, auth.getUserOrFail(), payload)
    return response.created(edition)
  }

  async show({ auth, params, response, tenant }: HttpContext) {
    const edition = await this.editionService.show(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(edition)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateBenefitEditionValidator)
    const edition = await this.editionService.update(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(edition)
  }

  async publish({ auth, params, response, tenant }: HttpContext) {
    const edition = await this.editionService.publish(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(edition)
  }

  async pause({ auth, params, response, tenant }: HttpContext) {
    const edition = await this.editionService.pause(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(edition)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    const edition = await this.editionService.archive(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(edition)
  }
}

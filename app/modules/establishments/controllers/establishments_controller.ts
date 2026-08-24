import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import EstablishmentService from '#modules/establishments/services/establishment_service'
import {
  createEstablishmentValidator,
  updateEstablishmentBusinessStatusValidator,
  updateEstablishmentRevisionValidator,
} from '#modules/establishments/validators/establishment_validator'

@inject()
export default class EstablishmentsController {
  constructor(
    private establishmentService: EstablishmentService,
    private completenessService: EstablishmentCompletenessService
  ) {}

  async index({ auth, params, response, tenant }: HttpContext) {
    const establishments = await this.establishmentService.list(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail()
    )
    return response.ok(establishments)
  }

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createEstablishmentValidator)
    const establishment = await this.establishmentService.create(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail(),
      payload
    )
    return response.created(establishment)
  }

  async show({ auth, params, response, tenant }: HttpContext) {
    const establishment = await this.establishmentService.show(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(establishment)
  }

  async updateRevision({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateEstablishmentRevisionValidator)
    const establishment = await this.establishmentService.updateRevision(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(establishment)
  }

  async updateBusinessStatus({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateEstablishmentBusinessStatusValidator)
    const establishment = await this.establishmentService.updateBusinessStatus(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.business_status
    )
    return response.ok(establishment)
  }

  async completeness({ auth, params, response, tenant }: HttpContext) {
    const result = await this.completenessService.check(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(result)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    await this.establishmentService.archive(tenant!.id, Number(params.id), auth.getUserOrFail())
    return response.noContent()
  }
}

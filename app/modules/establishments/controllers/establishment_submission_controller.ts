import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentRevisionCloneService from '#modules/establishments/services/establishment_revision_clone_service'
import EstablishmentSubmissionService from '#modules/establishments/services/establishment_submission_service'
import { createEstablishmentRevisionValidator } from '#modules/establishments/validators/establishment_review_validator'

@inject()
export default class EstablishmentSubmissionController {
  constructor(
    private submissionService: EstablishmentSubmissionService,
    private cloneService: EstablishmentRevisionCloneService
  ) {}

  async show({ auth, params, response, tenant }: HttpContext) {
    const result = await this.submissionService.status(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )

    return response.ok(result)
  }

  async submit({ auth, params, response, tenant }: HttpContext) {
    const result = await this.submissionService.submit(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )

    return result.submitted ? response.ok(result) : response.unprocessableEntity(result)
  }

  async createRevision({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createEstablishmentRevisionValidator)
    const revision = await this.cloneService.create(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )

    return response.created(revision)
  }
}

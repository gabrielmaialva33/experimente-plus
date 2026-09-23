import { inject } from '@adonisjs/core'
import { errors } from '@vinejs/vine'

import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type ReviewPolicy from '#modules/reviews/models/review_policy'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import type User from '#modules/users/models/user'

@inject()
export default class ReviewPolicyService {
  constructor(
    private policyRepository: ReviewPolicyRepository,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async getPolicy(tenantId: number, actor: User): Promise<ReviewPolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policyRepository.getForTenant(tenantId)
  }

  async updatePolicy(
    tenantId: number,
    actor: User,
    payload: IReview.UpdateReviewPolicyPayload
  ): Promise<ReviewPolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    // The table refuses a minimum above the maximum, and without this check the
    // refusal surfaced as a database error — a 500 for what is a mistake in the
    // input. Compared against the stored values too, because either bound can be
    // sent alone. Raised as a validation error so the API answers 422 and the
    // backoffice form shows it on the field.
    const current = await this.policyRepository.getForTenant(tenantId)
    const minimum = payload.min_text_length ?? current.min_text_length
    const maximum = payload.max_text_length ?? current.max_text_length
    if (minimum > maximum) {
      throw new errors.E_VALIDATION_ERROR([
        {
          field: 'max_text_length',
          rule: 'text_length_range',
          message: 'O máximo de caracteres não pode ser menor que o mínimo',
        },
      ])
    }

    return this.policyRepository.updateForTenant(tenantId, payload)
  }
}

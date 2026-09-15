import { inject } from '@adonisjs/core'

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
    return this.policyRepository.updateForTenant(tenantId, payload)
  }
}

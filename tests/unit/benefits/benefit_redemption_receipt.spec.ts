import { test } from '@japa/runner'

import NotFoundException from '#exceptions/not_found_exception'
import type BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import type BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import type BenefitPresentationTokenService from '#modules/benefits/services/benefit_presentation_token_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import type OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import type User from '#modules/users/models/user'

async function captureFailure(callback: () => Promise<unknown>): Promise<unknown> {
  try {
    await callback()
    return null
  } catch (error) {
    return error
  }
}

test.group('Benefit redemption receipt boundary', () => {
  test('rejects malformed codes before querying the repository', async ({ assert }) => {
    let repositoryCalls = 0
    const repository = {
      async findByReceiptForTenant() {
        repositoryCalls += 1
        throw new Error('Malformed receipt codes must not reach persistence')
      },
    } as unknown as BenefitRedemptionRepository

    const service = new BenefitRedemptionService(
      repository,
      {} as BenefitPresentationTokenService,
      {} as OrganizationPolicyService,
      {} as OrganizationResourceAuthorizationService,
      {} as BenefitAuditService
    )
    const actor = {} as User

    const holderFailure = await captureFailure(() =>
      service.holderReceipt(1, 'EXP-AAAAAAAAAAAAAAAZ', actor)
    )
    const partnerFailure = await captureFailure(() =>
      service.partnerReceipt(1, 'not-a-receipt', actor)
    )

    assert.instanceOf(holderFailure, NotFoundException)
    assert.equal((holderFailure as Error).message, 'Redemption receipt not found')
    assert.instanceOf(partnerFailure, NotFoundException)
    assert.equal((partnerFailure as Error).message, 'Redemption receipt not found')
    assert.equal(repositoryCalls, 0)
  })
})

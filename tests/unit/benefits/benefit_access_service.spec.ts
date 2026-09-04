import { test } from '@japa/runner'

import type BenefitAccessRepository from '#modules/benefits/repositories/benefit_access_repository'
import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import type BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import type OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

test.group('Benefit access service authorization', () => {
  test('allows the platform moderator read gate without requiring administration', async ({
    assert,
  }) => {
    const calls: string[] = []
    const accesses: never[] = []
    const repository = {
      async listForTenant(tenantId: number) {
        calls.push(`list:${tenantId}`)
        return accesses
      },
    } as unknown as BenefitAccessRepository
    const policy = {
      async requirePlatformModerator() {
        calls.push('moderator')
      },
      async requirePlatformAdmin() {
        calls.push('admin')
      },
    } as unknown as OrganizationPolicyService
    const service = new BenefitAccessService(
      repository,
      policy,
      {} as unknown as BenefitAuditService
    )

    const result = await service.list(17, {} as User)

    assert.strictEqual(result, accesses)
    assert.deepEqual(calls, ['moderator', 'list:17'])
  })

  test('keeps grants and revocations behind the platform admin gate', async ({ assert }) => {
    const calls: string[] = []
    const policy = {
      async requirePlatformModerator() {
        calls.push('moderator')
      },
      async requirePlatformAdmin() {
        calls.push('admin')
        throw new Error('admin-only')
      },
    } as unknown as OrganizationPolicyService
    const service = new BenefitAccessService(
      {} as BenefitAccessRepository,
      policy,
      {} as BenefitAuditService
    )

    await assert.rejects(
      () => service.grant(17, {} as User, {} as Parameters<BenefitAccessService['grant']>[2]),
      /admin-only/
    )
    await assert.rejects(
      () => service.revoke(17, 9, {} as User, {} as Parameters<BenefitAccessService['revoke']>[3]),
      /admin-only/
    )

    assert.deepEqual(calls, ['admin', 'admin'])
  })
})

import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { test } from '@japa/runner'

import type AuditLog from '#modules/audits/models/audit_log'
import type AuditRepository from '#modules/audits/repositories/audit_repository'
import AuditService from '#modules/audits/services/audit_service'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'

test.group('Benefit audit service', () => {
  test('forwards the transaction client to audit persistence', async ({ assert }) => {
    const client = {} as TransactionClientContract
    let persistedOptions: { client: TransactionClientContract } | undefined
    const repository = {
      async create(
        _payload: Partial<AuditLog>,
        options?: { client: TransactionClientContract }
      ): Promise<AuditLog> {
        persistedOptions = options
        return {} as AuditLog
      },
    } as unknown as AuditRepository
    const service = new BenefitAuditService(new AuditService(repository))

    await service.log(
      {
        actorId: 7,
        resource: 'benefit_redemptions',
        action: 'redeem',
        resourceId: 11,
      },
      { client }
    )

    assert.strictEqual(persistedOptions?.client, client)
  })
})
